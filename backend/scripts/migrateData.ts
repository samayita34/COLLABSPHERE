import prisma from '../src/lib/prisma';

async function main() {
    console.log("Starting data migration...");
    
    // Check if there's any unassigned project
    const unassignedProjects = await prisma.project.findMany({
        where: { workspaceId: null }
    });

    if (unassignedProjects.length === 0) {
        console.log("No unassigned projects found. Data migration complete.");
        return;
    }

    console.log(`Found ${unassignedProjects.length} unassigned projects. Setting up default workspace...`);

    // Create a default organization
    let defaultOrg = await prisma.organization.findUnique({
        where: { slug: "legacy-organization" }
    });

    if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({
            data: {
                name: "Legacy Organization",
                slug: "legacy-organization"
            }
        });
        console.log("Created Legacy Organization.");
    }

    // Create a default workspace
    let defaultWorkspace = await prisma.workspace.findUnique({
        where: { slug: "legacy-workspace" }
    });

    if (!defaultWorkspace) {
        defaultWorkspace = await prisma.workspace.create({
            data: {
                name: "Legacy Workspace",
                slug: "legacy-workspace",
                description: "Auto-generated workspace for legacy projects",
                organizationId: defaultOrg.id
            }
        });
        console.log("Created Legacy Workspace.");
    }

    // Assign all users to the legacy org and workspace
    const allUsers = await prisma.user.findMany();
    for (const user of allUsers) {
        // Add to Org
        await prisma.organizationMember.upsert({
            where: {
                organizationId_userId: {
                    organizationId: defaultOrg.id,
                    userId: user.id
                }
            },
            update: {},
            create: {
                organizationId: defaultOrg.id,
                userId: user.id,
                role: "ORG_ADMIN"
            }
        });

        // Add to Workspace
        await prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: {
                    workspaceId: defaultWorkspace.id,
                    userId: user.id
                }
            },
            update: {},
            create: {
                workspaceId: defaultWorkspace.id,
                userId: user.id,
                role: "WORKSPACE_ADMIN"
            }
        });
    }
    console.log(`Assigned ${allUsers.length} users to legacy workspace.`);

    // Update all unassigned projects to belong to the legacy workspace
    const updateResult = await prisma.project.updateMany({
        where: { workspaceId: null },
        data: { workspaceId: defaultWorkspace.id }
    });

    console.log(`Updated ${updateResult.count} projects to legacy workspace.`);
    console.log("Data migration completed successfully!");
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
