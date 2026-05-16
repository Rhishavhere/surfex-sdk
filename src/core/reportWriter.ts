import { generateText, LanguageModel } from "ai";

export type ReportSegmentStored = { url: string; title: string; body: string };

const REPORT_SYSTEM = `You are a dedicated research-report writer. You receive the user's original task and raw page text excerpts a browser agent saved. Your job is ONE polished Markdown document for a beautiful on-screen reader (headings, lists, tables, clear hierarchy).

OUTPUT RULES (strict):
- Output ONLY Markdown. No JSON, XML, HTML wrapper, or prose before/after the document. First line should be the main title.
- Start with exactly one level-1 heading: a single line "# <Descriptive report title>" summarizing the user's task and findings. Do not add extra H1s later.
- Structure the body with "##" for major sections (e.g. Overview, Key findings, Details, Sources). Use "###" for subsections. Never skip levels.
- Prefer 3-7 "##" sections so the report scans like a professional brief.
- The whole output should be beautifully formatted and highly presentable.

FORMATTING FOR READABILITY:
- Paragraphs: 4-6 sentences max; blank line between every paragraph.
- Lists: Use "- " for unordered lists. Use "1. " ordered lists only for sequences. Keep list items concise.
- Emphasis: use **bold** for key entities, figures, dates, names, verdicts.
- Tables and Quotes: Use GitHub-flavored Markdown tables. Blockquote for direct excerpts.

SOURCES:
- Near the end, include a "## Sources" section: bullet list of URLs (and optional page titles) that were relied on.

CONTENT:
- Synthesize across all segments into one coherent narrative. Do NOT paste raw segment dumps unless as a brief blockquote illustration.
- If segments conflict, say so plainly.`;

const MAX_BODY_PER_SEGMENT = 80_000;

function trimSegmentBody(body: string): string {
    if (body.length <= MAX_BODY_PER_SEGMENT) return body;
    return body.slice(0, MAX_BODY_PER_SEGMENT) + `\n\n_[Body truncated at ${MAX_BODY_PER_SEGMENT} characters]_\n`;
}

export async function writeUserConclusion(args: {
    goal: string;
    historyLines: readonly string[];
    agentDoneSummary: string;
    model: LanguageModel;
    signal?: AbortSignal;
}): Promise<string> {
    const { goal, historyLines, agentDoneSummary, model, signal } = args;
    
    const prompt = [
        `You are the "user interface" handler for an autonomous agent.`,
        `The agent has just declared it is "done" with its goal.`,
        `Goal: ${goal}`,
        `Agent's own final summary: ${agentDoneSummary}`,
        `Below is the complete execution history lines (JSON steps).`,
        `---`,
        ...historyLines,
        `---`,
        `Your job is to write a short, friendly, readable concluding sentence or paragraph for the USER.`,
        `Tell them what was found or achieved at a high level. Use a helpful, human tone. Do not mention technical step details or JSON.`,
        `Output ONLY the concluding text.`,
    ].join("\n");

    try {
        const { text } = await generateText({
            model,
            prompt,
            abortSignal: signal,
            maxOutputTokens: 500,
        });
        return text.trim();
    } catch (err) {
        console.error("Error generating clean user conclusion:", err);
        return agentDoneSummary;
    }
}

export async function generateResearchReportMarkdown(args: {
    goal: string;
    segments: ReportSegmentStored[];
    historyLines: readonly string[];
    model: LanguageModel;
    signal?: AbortSignal;
}): Promise<string | null> {
    if (args.segments.length === 0) return null;

    const segmentBlocks = args.segments.map((s, i) => {
        const b = trimSegmentBody(s.body);
        return [
            `### Segment ${i + 1}`,
            `URL: ${s.url}`,
            `Page title: ${s.title}`,
            "",
            "```",
            b,
            "```",
        ].join("\n");
    }).join("\n\n---\n\n");

    const trace = args.historyLines.length > 0 ? args.historyLines.join("\n") : "(no action trace)";

    try {
        const { text } = await generateText({
            model: args.model,
            system: REPORT_SYSTEM,
            abortSignal: args.signal,
            maxRetries: 1,
            maxOutputTokens: 8192,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: [
                                `Original user task:`,
                                args.goal,
                                "",
                                `Saved page content (${args.segments.length} segment(s)):`,
                                segmentBlocks,
                                "",
                                `Optional action trace (recent, for context only):`,
                                trace,
                                "",
                                "Write the full styled Markdown report now, following every OUTPUT and FORMATTING rule in your system prompt.",
                            ].join("\n"),
                        },
                    ],
                },
            ],
        });

        return text.trim();
    } catch (err) {
        console.error("Error generating research report:", err);
        return null;
    }
}
