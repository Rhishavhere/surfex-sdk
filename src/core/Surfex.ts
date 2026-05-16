import { generateText, LanguageModel } from "ai";
import { BrowserDriver } from "../drivers/BrowserDriver";
import { SYSTEM_BLIND, SYSTEM_VISION, buildUserPrompt } from "./promptBuilder";
import { AgentEvent, AgentStep, parseOrRepairAgentStep } from "./schema";
import { writeUserConclusion, generateResearchReportMarkdown, ReportSegmentStored } from "./reportWriter";

export interface SurfexOptions {
    model: LanguageModel;
}

export interface RunOptions {
    goal: string;
    driver: BrowserDriver;
    maxSteps?: number;
    onEvent?: (event: AgentEvent) => void;
    generateReport?: boolean;
    generateConclusion?: boolean;
}

export interface SurfexResult {
    success: boolean;
    summary: string;
    conclusion: string;
    report: string | null;
}

interface AgentRunState {
    historyLines: string[];
    visionFromNow: boolean;
    executedSteps: number;
    plannerRounds: number;
    lastReadPageUrl: string | null;
    lastReadCapture: ReportSegmentStored | null;
    reportSegments: ReportSegmentStored[];
    isResearchGoal: boolean;
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

    async run(options: RunOptions): Promise<SurfexResult> {
        const { 
            goal, 
            driver, 
            maxSteps = 60, 
            onEvent = () => {},
            generateReport = true,
            generateConclusion = true
        } = options;
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
            lastReadCapture: null,
            reportSegments: [],
            isResearchGoal: generateReport && /research|analysiss|summary|report|plan|find out/i.test(goal),
        };
        const maxPlannerRounds = maxSteps * 4 + 12;

        try {
            while (state.executedSteps < maxSteps && state.plannerRounds < maxPlannerRounds) {
                if (signal.aborted) {
                    onEvent({ type: "finished", reason: "stopped" });
                    return this.finalizeRun(goal, "stopped - user aborted", state, signal, generateConclusion, generateReport);
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
                        return this.finalizeRun(goal, `error: screenshot failed`, state, signal, generateConclusion, generateReport, false);
                    }
                }

                const useImageInRequest = state.visionFromNow && hasValidScreenshot;
                const recent = state.historyLines.length > 0
                    ? `Full action history:\n${state.historyLines.join("\n")}`
                    : "";

                const url = await driver.evaluate<string>("window.location.href");
                const title = await driver.evaluate<string>("document.title");

                const researchReminder = state.isResearchGoal
                    ? "REMINDER: This is a research/analysis goal. You MUST call save_report after read_page on important sources. The reporting agent has no data unless you do."
                    : "";

                const snapshotSection = state.lastReadCapture
                    ? [
                        "---",
                        "Page snapshot (included once after read_page — use exact text for quotes and summaries):",
                        state.lastReadCapture.body.slice(0, 15000), // pass a snippet back to agent reasoning
                        "---",
                      ].join("\n\n")
                    : "";

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
                    researchReminder,
                    recent,
                    snapshotSection,
                });

                // Clear the capture snippet after showing it to the agent once
                // Wait, we can't clear it before checking if they saved it, so we'll clear it after execution.

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
                    return this.finalizeRun(goal, `error: llm failed`, state, signal, generateConclusion, generateReport, false);
                }

                if (action.action === "see") {
                    if (state.visionFromNow) continue;
                    state.visionFromNow = true;
                    continue;
                }

                if (action.action === "done") {
                    onEvent({ type: "finished", reason: action.summary });
                    return this.finalizeRun(goal, action.summary, state, signal, generateConclusion, generateReport, true);
                }

                onEvent({ type: "step", step: state.executedSteps + 1, action });

                // Execute Action against Driver
                try {
                    switch (action.action) {
                        case "navigate":
                            await driver.goto(action.url);
                            state.lastReadPageUrl = null;
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
                        case "read_page":
                            const bodyText = await driver.evaluate<string>("document.body.innerText || document.body.textContent || ''");
                            state.lastReadCapture = {
                                url,
                                title,
                                body: bodyText
                            };
                            state.lastReadPageUrl = url;
                            break;
                        case "save_report":
                            if (state.lastReadCapture) {
                                state.reportSegments.push({ ...state.lastReadCapture });
                                onEvent({ type: "log", message: `[agent] Saved segment for report: ${state.lastReadCapture.url}` });
                            } else {
                                onEvent({ type: "log", message: `[agent] Tried to save_report but read_page was not called recently.` });
                            }
                            break;
                    }
                } catch (execErr) {
                    onEvent({ type: "error", message: `execute_step_failed: ${String(execErr)}` });
                    return this.finalizeRun(goal, `error: execution failed`, state, signal, generateConclusion, generateReport, false);
                }

                state.historyLines.push(JSON.stringify(action));
                state.executedSteps += 1;
                state.visionFromNow = true;
                
                await driver.waitForTimeout(350);
            }

            const reason = state.executedSteps >= maxSteps ? "max_steps" : "max_planner_rounds";
            onEvent({ type: "finished", reason });
            return this.finalizeRun(goal, reason, state, signal, generateConclusion, generateReport, false);
            
        } finally {
            if (myRunId === this.currentRunId) {
                this.abortController = null;
            }
        }
    }

    private async finalizeRun(
        goal: string,
        summary: string,
        state: AgentRunState,
        signal: AbortSignal,
        generateConclusion: boolean,
        generateReport: boolean,
        success = true
    ): Promise<SurfexResult> {
        // If there's an error and no history, return basic
        if (!success && state.historyLines.length === 0) {
            return { success, summary, conclusion: summary, report: null };
        }

        // 1. Write the conclusion
        let conclusion = summary;
        if (generateConclusion) {
            conclusion = await writeUserConclusion({
                goal,
                historyLines: state.historyLines,
                agentDoneSummary: summary,
                model: this.options.model,
                signal,
            });
        }

        // 2. Generate the Markdown report
        let report = null;
        if (generateReport) {
            report = await generateResearchReportMarkdown({
                goal,
                segments: state.reportSegments,
                historyLines: state.historyLines,
                model: this.options.model,
                signal,
            });
        }

        return {
            success,
            summary,
            conclusion,
            report,
        };
    }
}
