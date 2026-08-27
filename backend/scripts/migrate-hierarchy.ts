import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new (PrismaClient as any)({ adapter });

async function main() {
    console.log("Starting hierarchy migration...");

    const users = await prisma.user.findMany({
        include: {
            ownedProjects: true,
        },
    });

    for (const user of users) {
        if (user.ownedProjects.length === 0) {
            continue; // Skip users without projects
        }

        console.log(`Processing user: ${user.email}`);

        // 1. Create Default Organization
        const orgSlug = `org-${user.id.substring(0, 8)}`;
        let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });

        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: `${user.firstName}'s Organization`,
                    slug: orgSlug,
                    members: {
                        create: {
                            userId: user.id,
                            role: "ORG_ADMIN",
                        },
                    },
                },
            });
            console.log(`Created organization: ${org.name}`);
        }

        // 2. Create Default Workspace
        const wsSlug = `ws-${user.id.substring(0, 8)}`;
        let ws = await prisma.workspace.findUnique({ where: { slug: wsSlug } });

        if (!ws) {
            ws = await prisma.workspace.create({
                data: {
                    name: "Default Workspace",
                    slug: wsSlug,
                    organizationId: org.id,
                    description: "Auto-migrated workspace",
                    members: {
                        create: {
                            userId: user.id,
                            role: "WORKSPACE_ADMIN",
                        },
                    },
                },
            });
            console.log(`Created workspace: ${ws.name}`);
        }

        // 3. Migrate Projects
        const projectsToUpdate = user.ownedProjects.filter((p: any) => !p.workspaceId);
        if (projectsToUpdate.length > 0) {
            await prisma.project.updateMany({
                where: {
                    id: { in: projectsToUpdate.map((p: any) => p.id) },
                },
                data: {
                    workspaceId: ws.id,
                },
            });
            console.log(`Migrated ${projectsToUpdate.length} projects for user ${user.email}`);
        }
    }

    console.log("Migration complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
