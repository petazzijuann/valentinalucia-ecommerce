import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/lib/prode/auth";
import { getProdeSettings } from "@/lib/prode/settings";

export async function GET() {
  const [player, settings] = await Promise.all([
    getSessionPlayer(),
    getProdeSettings(),
  ]);

  return NextResponse.json({
    player: player
      ? {
          instagram: player.instagram,
          submitted: player.submitted_at !== null,
          total_points: player.total_points,
        }
      : null,
    locked: settings.predictions_locked,
  });
}
