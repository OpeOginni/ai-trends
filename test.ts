import * as google from "@/server/providers/google";
import * as openrouter from "@/server/providers/openrouter";
import * as openai from "@/server/providers/openai";
import * as anthropic from "@/server/providers/anthropic";
import * as xai from "@/server/providers/xai";

async function main() {
    const response = await google.getResponseWithWebSearch("Who is the best Tech/Developer Social Media Influencer?", {name: "gemini-2.5-pro", temperature: true, supportsObjectOutput: false});
    console.log(response);
}

main();

// bun run test.ts