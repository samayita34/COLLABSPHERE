import prisma from "../src/lib/prisma";

async function main() {
    const enums = [
        "TASK_STATUS_CHANGED",
        "TASK_OVERDUE",
        "TASK_PRIORITY_CHANGED",
        "PROJECT_MEMBER_ADDED",
        "PROJECT_MEMBER_REMOVED",
        "SUBTASK_COMPLETED",
    ];

    for (const val of enums) {
        try {
            await prisma.$executeRawUnsafe(`ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS '${val}'`);
            console.log(`Added enum: ${val}`);
        } catch (err: any) {
            console.log(`Enum note (${val}):`, err.message);
        }
    }
    console.log("Enum migration complete.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
});
