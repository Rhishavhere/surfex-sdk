import { generateText, LanguageModel } from "ai";
import { BrowserDriver } from "../drivers/BrowserDriver";
import { SYSTEM_BLIND, SYSTEM_VISION, buildUserPrompt } from "./promptBuilder";
import { AgentEvent, AgentStep, parseOrRepairAgentStep } from "./schema";

export interface SurfexOptions {
    model: LanguageModel;
}

export interface RunOptions {
    goal: string;
    driver: BrowserDriver;
    maxSteps?: number;
    onEvent?: (event: AgentEvent) => void;
}

interface AgentRunState {
    historyLines: string[];
    visionFromNow: boolean;
    executedSteps: number;
    plannerRounds: number;
    lastReadPageUrl: string | null;
}

export class Surfex {
    private abortController: AbortController | null = null;
    private currentRunId = 0;

    constructor(private options: SurfexOptions) {}

    stop(): void {
        this.currentRunId++;
        this.abortController?.abort();
        this.abortController = null;
    }

    async run(options: RunOptions): Promise<void> {
        const { goal, driver, maxSteps = 60, onEvent = () => {} } = options;
        const { model } = this.options;

        this.abortController?.abort();
        this.abortController = new AbortController();
        const myRunId = ++this.currentRunId;
        const { signal } = this.abortController;

        const state: AgentRunState = {
            historyLines: [],
            visionFromNow: false,
            executedSteps: 0,
            plannerRounds: 0,
            lastReadPageUrl: null,
        };
        const maxPlannerRounds = maxSteps * 4 + 12;

        try {
            while (state.executedSteps < maxSteps && state.plannerRounds < maxPlannerRounds) {
                if (signal.aborted) {
                    onEvent({ type: "finished", reason: "stopped" });
                    return;
                }

                state.plannerRounds += 1;

                let dims = null;
                let imageDataUrl = "";
                let hasValidScreenshot = false;

                if (state.visionFromNow) {
                    try {
                        const base64Screenshot = await driver.getScreenshot();
                        if (base64Screenshot) {
                            imageDataUrl = `data:image/png;base64,${base64Screenshot}`;
                            hasValidScreenshot = true;
                            
                            const vp = await driver.evaluate<[number, number]>(
                                "(() => [window.innerWidth, window.innerHeight])()"
                            );
                            
                            // Using viewport dimensions as shot dimensions for headless mode
                            // Actual driver implementations may refine this
                            dims = {
                                shotW: vp[0],
                                shotH: vp[1],
                                viewW: vp[0],
                                viewH: vp[1],
                            };
                        } else {
                            onEvent({ type: "log", message: "[agent] Screenshot empty, treating as blind turn." });
                        }
                    } catch (e) {
                        onEvent({ type: "error", message: `screenshot_failed: ${String(e)}` });
                        return;
                    }
                }

                const useImageInRequest = state.visionFromNow && hasValidScreenshot;
                const recent = state.historyLines.length > 0
                    ? `Full action history:\n${state.historyLines.join("\n")}`
                    : "";

                const url = await driver.evaluate<string>("window.location.href");
                const title = await driver.evaluate<string>("document.title");

                const visionBase = buildUserPrompt({
                    useImageInRequest,
                    visionFromNow: state.visionFromNow,
                    goal,
                    executedSteps: state.executedSteps,
                    maxSteps,
                    plannerRounds: state.plannerRounds,
                    url,
                    title,
                    dims,
                    researchReminder: "", // Extracted generic
                    recent,
                    snapshotSection: "",
                });

                const system = useImageInRequest ? SYSTEM_VISION : SYSTEM_BLIND;
                const userContent = useImageInRequest
                    ? [
                        { type: "image" as const, image: imageDataUrl },
                        { type: "text" as const, text: visionBase },
                    ] as const
                    : [{ type: "text" as const, text: visionBase }];

                let action: AgentStep;
                try {
                    const { text } = await generateText({
                        model,
                        system,
                        abortSignal: signal,
                        maxRetries: 1,
                        messages: [{ role: "user", content: [...userContent] }],
                    });
                    action = await parseOrRepairAgentStep(text, model, signal, onEvent);
                } catch (e) {
                    onEvent({ type: "error", message: `llm_error: ${String(e)}` });
                    return;
                }

                if (action.action === "see") {
                    if (state.visionFromNow) continue;
                    state.visionFromNow = true;
                    continue;
                }

                if (action.action === "done") {
                    onEvent({ type: "finished", reason: action.summary });
                    return;
                }

                onEvent({ type: "step", step: state.executedSteps + 1, action });

                // Execute Action against Driver
                try {
                    switch (action.action) {
                        case "navigate":
                            await driver.goto(action.url);
                            break;
                        case "click_xy":
                            await driver.click(action.x, action.y);
                            break;
                        case "type":
                            await driver.type(action.text);
                            break;
                        case "wait":
                            await driver.waitForTimeout(action.ms);
                            break;
                        // Add more driver mappings as needed
                    }
                } catch (execErr) {
                    onEvent({ type: "error", message: `execute_step_failed: ${String(execErr)}` });
                    return;
                }

                state.historyLines.push(JSON.stringify(action));
                state.executedSteps += 1;
                state.visionFromNow = true;
                
                await driver.waitForTimeout(350);
            }

            onEvent({ type: "finished", reason: state.executedSteps >= maxSteps ? "max_steps" : "max_planner_rounds" });
            
        } finally {
            if (myRunId === this.currentRunId) {
                this.abortController = null;
            }
        }
    }
}
