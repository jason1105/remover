import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { llmStatus } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...db(), llm: llmStatus() });
}
