import { useEffect, useState, type DragEvent } from "react";
import { useParams, Link } from "react-router-dom";
import "./Projects.css";
import "./ProjectWorkspace.css";
import TaskModal from "./TaskModal";
import { MemberDetailModal, AddMemberModal } from "./MemberModal";
import { DocumentDetailModal, AddDocumentModal } from "./DocumentModal";
import { FileDetailModal, AddFileModal } from "./FileModal";
import ProjectChat, { type ChatMessage } from "./ProjectChat";

/* =========================
   TYPES
   Shaped to line up with the eventual Prisma models
   (Project, Task, Member). Swap the mock data below for
   real fetches once the backend endpoints exist.
========================= */

type TaskStatus = "todo" | "progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high";

interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    due: string;
    assignee: string;
}

interface Member {
    initials: string;
    name: string;
    role: string;
    email: string;
}

type DocType = "DOC" | "PDF" | "XLS" | "PPT";

interface ProjectDocument {
    id: string;
    name: string;
    description: string;
    type: DocType;
    owner: string;
    createdAt: string;
    updatedAt: string;
    size?: string;
}

type FileType = "PDF" | "PNG" | "JPG" | "FIG" | "ZIP" | "PPT" | "DOC" | "MP4" | "XLS";
type FileCategory = "images" | "documents" | "design" | "archives" | "videos";

const FILE_CATEGORY: Record<FileType, FileCategory> = {
    PNG: "images",
    JPG: "images",
    PDF: "documents",
    DOC: "documents",
    XLS: "documents",
    PPT: "documents",
    FIG: "design",
    ZIP: "archives",
    MP4: "videos",
};

interface ProjectFile {
    id: string;
    name: string;
    type: FileType;
    size: string;
    uploadedBy: string;
    uploadedAt: string;
    modifiedAt?: string;
    description?: string;
}

interface Project {
    slug: string;
    initials: string;
    name: string;
    category: string;
    description: string;
    status: "ACTIVE" | "COMPLETED";
    progress: number;
    tasksDone: number;
    tasksTotal: number;
    date: string;
    members: Member[];
    tasks: Task[];
    documents: ProjectDocument[];
    files: ProjectFile[];
    messages: ChatMessage[];
}

/* Relative-time helper for the mock chat data below, so the
   "Today" / "Yesterday" separators are always accurate no matter
   when this demo is loaded, instead of hardcoding calendar dates
   that would go stale. */
const HOUR = 60 * 60 * 1000;
const chatTime = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR).toISOString();

/* =========================
   MOCK DATA
   Local to this page for now. Mirrors the project shape
   used on the Projects page. Replace with a shared store
   / API call once the backend is wired up.
========================= */

const projects: Project[] = [
    {
        slug: "website-redesign",
        initials: "WR",
        name: "Website Redesign",
        category: "Design & Frontend",
        description:
            "Overhaul of the enterprise marketing platform, brand assets, and interactive component library.",
        status: "ACTIVE",
        progress: 78,
        tasksDone: 18,
        tasksTotal: 23,
        date: "Aug 28, 2026",
        members: [
            { initials: "AR", name: "Aditi Rao", role: "Product Designer", email: "aditi.rao@acmecorp.com" },
            { initials: "PS", name: "Pranav Sen", role: "Frontend Engineer", email: "pranav.sen@acmecorp.com" },
            { initials: "SR", name: "Samayita Ray", role: "Workspace Admin", email: "samayita.ray@acmecorp.com" },
            { initials: "JM", name: "Jordan Mehta", role: "Brand Lead", email: "jordan.mehta@acmecorp.com" },
        ],
        tasks: [
            { id: "t1", title: "Audit existing component library", description: "Catalogue every current component and flag ones that break the new spacing tokens.", status: "done", priority: "medium", due: "Aug 02", assignee: "PS" },
            { id: "t2", title: "Define new type scale and spacing tokens", status: "done", priority: "medium", due: "Aug 05", assignee: "AR" },
            { id: "t3", title: "Rebuild navigation and sidebar shell", description: "Replace the fixed sidebar with a collapsible shell that supports nested workspaces.", status: "progress", priority: "high", due: "Aug 19", assignee: "PS" },
            { id: "t4", title: "Design hero and marketing landing sections", status: "progress", priority: "medium", due: "Aug 21", assignee: "AR" },
            { id: "t5", title: "QA pass on interactive component states", description: "Focus/hover/disabled states across buttons, inputs, and cards.", status: "review", priority: "medium", due: "Aug 24", assignee: "JM" },
            { id: "t6", title: "Accessibility review of form components", status: "review", priority: "high", due: "Aug 25", assignee: "SR" },
            { id: "t7", title: "Write component library documentation", status: "todo", priority: "low", due: "Aug 27", assignee: "JM" },
            { id: "t8", title: "Cross-browser regression pass", status: "todo", priority: "medium", due: "Aug 28", assignee: "PS" },
        ],
        documents: [
            { id: "d1", name: "Project Requirements", description: "Scope, goals, and success criteria for the redesign.", type: "DOC", owner: "Samayita Ray", createdAt: "Jul 02, 2026", updatedAt: "Aug 10, 2026", size: "184 KB" },
            { id: "d2", name: "Product Specification", description: "Detailed functional spec for the new component library.", type: "DOC", owner: "Aditi Rao", createdAt: "Jul 08, 2026", updatedAt: "Aug 14, 2026", size: "412 KB" },
            { id: "d3", name: "Meeting Notes — August 2026", description: "Notes and decisions from the weekly design sync.", type: "DOC", owner: "Jordan Mehta", createdAt: "Aug 05, 2026", updatedAt: "Aug 12, 2026", size: "96 KB" },
            { id: "d4", name: "UI Guidelines", description: "Typography, spacing, and component usage guidelines.", type: "PDF", owner: "Aditi Rao", createdAt: "Jul 15, 2026", updatedAt: "Aug 09, 2026", size: "2.3 MB" },
            { id: "d5", name: "API Documentation", description: "Endpoints and payloads for the marketing site integration.", type: "DOC", owner: "Pranav Sen", createdAt: "Jul 20, 2026", updatedAt: "Aug 15, 2026", size: "268 KB" },
            { id: "d6", name: "Project Roadmap", description: "Milestones and delivery timeline through Q3.", type: "PPT", owner: "Samayita Ray", createdAt: "Jun 28, 2026", updatedAt: "Aug 01, 2026", size: "1.1 MB" },
        ],
        files: [
            { id: "f1", name: "brand-assets.zip", type: "ZIP", size: "48.2 MB", uploadedBy: "Aditi Rao", uploadedAt: "Jul 03, 2026", modifiedAt: "Aug 09, 2026", description: "Logos, color tokens, and icon set for the redesign." },
            { id: "f2", name: "homepage-final.fig", type: "FIG", size: "12.6 MB", uploadedBy: "Aditi Rao", uploadedAt: "Aug 12, 2026", description: "Final approved homepage layout and components." },
            { id: "f3", name: "project-presentation.pptx", type: "PPT", size: "6.8 MB", uploadedBy: "Samayita Ray", uploadedAt: "Jul 30, 2026", modifiedAt: "Aug 01, 2026" },
            { id: "f4", name: "user-research.pdf", type: "PDF", size: "3.1 MB", uploadedBy: "Jordan Mehta", uploadedAt: "Jul 18, 2026", description: "Usability findings from the June research round." },
            { id: "f5", name: "database-schema.png", type: "PNG", size: "820 KB", uploadedBy: "Pranav Sen", uploadedAt: "Aug 05, 2026" },
        ],
        messages: [
            { id: "m1", senderInitials: "PS", text: "Audit of the existing component library is complete. I've added the findings to the project documentation.", timestamp: chatTime(29) },
            { id: "m2", senderInitials: "AR", text: "I've updated the hero section based on the latest design feedback.", timestamp: chatTime(26) },
            { id: "m3", senderInitials: "JM", text: "QA pass is ready for review. I found two issues with the interactive states.", timestamp: chatTime(4) },
            { id: "m4", senderInitials: "SR", text: "I'll review the remaining tasks and update the project timeline today.", timestamp: chatTime(3) },
        ],
    },
    {
        slug: "mobile-application",
        initials: "MA",
        name: "Mobile Application",
        category: "iOS & Android",
        description:
            "Next-generation cross-platform mobile client with real-time sync and offline-first task execution.",
        status: "ACTIVE",
        progress: 45,
        tasksDone: 13,
        tasksTotal: 24,
        date: "Sep 15, 2026",
        members: [
            { initials: "JM", name: "Jordan Mehta", role: "Brand Lead", email: "jordan.mehta@acmecorp.com" },
            { initials: "KL", name: "Kabir Luthra", role: "Mobile Engineer", email: "kabir.luthra@acmecorp.com" },
            { initials: "AR", name: "Aditi Rao", role: "Product Designer", email: "aditi.rao@acmecorp.com" },
        ],
        tasks: [
            { id: "t1", title: "Set up offline-first sync layer", status: "progress", priority: "high", due: "Aug 22", assignee: "KL" },
            { id: "t2", title: "Design onboarding flow", status: "review", priority: "medium", due: "Aug 20", assignee: "AR" },
            { id: "t3", title: "Push notification service integration", status: "todo", priority: "medium", due: "Sep 01", assignee: "KL" },
        ],
        documents: [
            { id: "d1", name: "Product Specification", description: "Core flows and platform requirements for v1.", type: "DOC", owner: "Jordan Mehta", createdAt: "Jul 10, 2026", updatedAt: "Aug 08, 2026", size: "356 KB" },
            { id: "d2", name: "API Documentation", description: "Mobile client endpoints for sync and offline queueing.", type: "DOC", owner: "Kabir Luthra", createdAt: "Jul 18, 2026", updatedAt: "Aug 11, 2026", size: "198 KB" },
            { id: "d3", name: "UI Guidelines", description: "Mobile-specific spacing and gesture guidelines.", type: "PDF", owner: "Aditi Rao", createdAt: "Jul 22, 2026", updatedAt: "Aug 06, 2026", size: "1.8 MB" },
        ],
        files: [
            { id: "f1", name: "product-demo.mp4", type: "MP4", size: "64.5 MB", uploadedBy: "Kabir Luthra", uploadedAt: "Aug 07, 2026", description: "Walkthrough of the offline-sync prototype." },
            { id: "f2", name: "project-assets.zip", type: "ZIP", size: "22.4 MB", uploadedBy: "Aditi Rao", uploadedAt: "Jul 25, 2026" },
            { id: "f3", name: "API-reference.pdf", type: "PDF", size: "1.4 MB", uploadedBy: "Kabir Luthra", uploadedAt: "Jul 19, 2026", modifiedAt: "Aug 02, 2026" },
        ],
        messages: [
            { id: "m1", senderInitials: "KL", text: "Offline sync layer is passing local tests now — pushing to the shared branch shortly.", timestamp: chatTime(22) },
            { id: "m2", senderInitials: "AR", text: "Onboarding flow mockups are in the design file, ready for a look whenever you're free.", timestamp: chatTime(20) },
            { id: "m3", senderInitials: "JM", text: "Nice work both — I'll take a pass on the onboarding flow this afternoon.", timestamp: chatTime(5) },
        ],
    },
    {
        slug: "internal-portal",
        initials: "IP",
        name: "Internal Portal",
        category: "Infrastructure",
        description:
            "Unified admin control centre for team permissions, analytics telemetry, and SSO security controls.",
        status: "COMPLETED",
        progress: 100,
        tasksDone: 22,
        tasksTotal: 22,
        date: "Done Aug 02, 2026",
        members: [
            { initials: "SR", name: "Samayita Ray", role: "Workspace Admin", email: "samayita.ray@acmecorp.com" },
            { initials: "PS", name: "Pranav Sen", role: "Frontend Engineer", email: "pranav.sen@acmecorp.com" },
        ],
        tasks: [
            { id: "t1", title: "SSO provider integration", status: "done", priority: "high", due: "Jul 20", assignee: "SR" },
            { id: "t2", title: "Permissions and role matrix", status: "done", priority: "medium", due: "Jul 26", assignee: "PS" },
        ],
        documents: [
            { id: "d1", name: "Project Requirements", description: "Access control and audit requirements for the portal.", type: "DOC", owner: "Samayita Ray", createdAt: "Jun 10, 2026", updatedAt: "Jul 28, 2026", size: "220 KB" },
            { id: "d2", name: "Project Roadmap", description: "Delivery plan across SSO, permissions, and analytics.", type: "XLS", owner: "Samayita Ray", createdAt: "Jun 12, 2026", updatedAt: "Aug 02, 2026", size: "88 KB" },
        ],
        files: [
            { id: "f1", name: "database-schema.png", type: "PNG", size: "540 KB", uploadedBy: "Pranav Sen", uploadedAt: "Jun 20, 2026" },
            { id: "f2", name: "project-assets.zip", type: "ZIP", size: "9.8 MB", uploadedBy: "Samayita Ray", uploadedAt: "Jul 15, 2026", modifiedAt: "Jul 28, 2026" },
        ],
        messages: [],
    },
    {
        slug: "marketing-campaign",
        initials: "MC",
        name: "Marketing Campaign",
        category: "Growth & Brand",
        description:
            "Q3 global product launch collateral, video assets, and targeted enterprise lead-generation funnels.",
        status: "ACTIVE",
        progress: 60,
        tasksDone: 9,
        tasksTotal: 15,
        date: "Sep 30, 2026",
        members: [
            { initials: "AR", name: "Aditi Rao", role: "Product Designer", email: "aditi.rao@acmecorp.com" },
            { initials: "SR", name: "Samayita Ray", role: "Workspace Admin", email: "samayita.ray@acmecorp.com" },
            { initials: "KL", name: "Kabir Luthra", role: "Mobile Engineer", email: "kabir.luthra@acmecorp.com" },
        ],
        tasks: [
            { id: "t1", title: "Launch video storyboard", status: "progress", priority: "high", due: "Aug 25", assignee: "AR" },
            { id: "t2", title: "Lead-gen funnel copy", status: "todo", priority: "medium", due: "Sep 05", assignee: "SR" },
        ],
        documents: [
            { id: "d1", name: "Product Specification", description: "Campaign scope, channels, and target segments.", type: "DOC", owner: "Samayita Ray", createdAt: "Jul 05, 2026", updatedAt: "Aug 13, 2026", size: "160 KB" },
            { id: "d2", name: "Project Roadmap", description: "Launch timeline and content delivery milestones.", type: "PPT", owner: "Aditi Rao", createdAt: "Jul 08, 2026", updatedAt: "Aug 09, 2026", size: "3.4 MB" },
            { id: "d3", name: "Meeting Notes — August 2026", description: "Notes from the campaign kickoff review.", type: "DOC", owner: "Kabir Luthra", createdAt: "Aug 03, 2026", updatedAt: "Aug 03, 2026", size: "54 KB" },
        ],
        files: [
            { id: "f1", name: "product-demo.mp4", type: "MP4", size: "51.2 MB", uploadedBy: "Aditi Rao", uploadedAt: "Aug 04, 2026", description: "Launch video first cut." },
            { id: "f2", name: "brand-assets.zip", type: "ZIP", size: "31.6 MB", uploadedBy: "Aditi Rao", uploadedAt: "Jul 09, 2026" },
            { id: "f3", name: "project-presentation.pptx", type: "PPT", size: "5.2 MB", uploadedBy: "Samayita Ray", uploadedAt: "Jul 12, 2026", modifiedAt: "Aug 06, 2026" },
        ],
        messages: [
            { id: "m1", senderInitials: "AR", text: "First cut of the launch video storyboard is ready for feedback.", timestamp: chatTime(27) },
            { id: "m2", senderInitials: "KL", text: "Storyboard looks solid — pacing on the middle section could be tightened a bit.", timestamp: chatTime(24) },
            { id: "m3", senderInitials: "SR", text: "Agreed on the pacing note. I'll have the lead-gen funnel copy over by end of day.", timestamp: chatTime(2) },
        ],
    },
];

const activity = [
    { text: "Pranav Sen marked \"Audit existing component library\" as done", time: "2h ago" },
    { text: "Aditi Rao commented on the hero section design", time: "5h ago" },
    { text: "Jordan Mehta moved \"QA pass on interactive states\" to Review", time: "Yesterday" },
    { text: "Samayita Ray added Kabir Luthra to the project", time: "2 days ago" },
];

const TABS = ["Overview", "Tasks", "Board", "Members", "Documents", "Files", "Chat", "Activity"] as const;
type Tab = (typeof TABS)[number];

const COLUMNS: { key: TaskStatus; label: string }[] = [
    { key: "todo", label: "TO DO" },
    { key: "progress", label: "IN PROGRESS" },
    { key: "review", label: "REVIEW" },
    { key: "done", label: "DONE" },
];

const TAG_LABEL: Record<TaskStatus, string> = {
    todo: "To do",
    progress: "In progress",
    review: "Review",
    done: "Done",
};

const STATUS_FILTERS: { key: "all" | TaskStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "todo", label: "To do" },
    { key: "progress", label: "In progress" },
    { key: "review", label: "Review" },
    { key: "done", label: "Done" },
];

const PRIORITY_FILTERS: { key: "all" | TaskPriority; label: string }[] = [
    { key: "all", label: "All priorities" },
    { key: "high", label: "High priority" },
    { key: "medium", label: "Medium priority" },
    { key: "low", label: "Low priority" },
];

const DOC_TYPE_FILTERS: { key: "all" | DocType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "DOC", label: "Documents" },
    { key: "PDF", label: "PDFs" },
    { key: "XLS", label: "Spreadsheets" },
    { key: "PPT", label: "Presentations" },
];

const FILE_CATEGORY_FILTERS: { key: "all" | FileCategory; label: string }[] = [
    { key: "all", label: "All" },
    { key: "images", label: "Images" },
    { key: "documents", label: "Documents" },
    { key: "design", label: "Design" },
    { key: "archives", label: "Archives" },
    { key: "videos", label: "Videos" },
];

export default function ProjectWorkspace() {
    const { slug } = useParams<{ slug: string }>();
    const [activeTab, setActiveTab] = useState<Tab>("Overview");

    const project = projects.find((p) => p.slug === slug) ?? projects[0];

    /* =========================
       TASK STATE
       Lifted out of the static mock data so the Board can move,
       edit, and create tasks. Resets whenever the project changes.
       Swap setTasks calls for API mutations once the backend exists.
    ========================= */
    const [tasks, setTasks] = useState<Task[]>(project.tasks);

    /* =========================
       MEMBER STATE
       Lifted the same way as tasks, so the Members tab can add
       people and have them immediately available as assignees
       everywhere else (header avatars, tab count, task modal).
       Resets whenever the project changes.
    ========================= */
    const [members, setMembers] = useState<Member[]>(project.members);

    /* =========================
       DOCUMENT STATE
       Same lift-and-reset pattern as tasks/members. Documents
       don't reference task/member identifiers, so this is a
       fully independent piece of state -- no shared/duplicate
       task or member system here.
    ========================= */
    const [documents, setDocuments] = useState<ProjectDocument[]>(project.documents);

    /* =========================
       FILE STATE
       Same lift-and-reset pattern as tasks/members/documents.
       Kept independent of ProjectDocument -- Files is uploaded
       assets/attachments, Documents is structured project content.
    ========================= */
    const [files, setFiles] = useState<ProjectFile[]>(project.files);

    /* =========================
       CHAT STATE
       Same lift-and-reset pattern as tasks/members/documents/files.
       Reuses the live `members` state for sender identity -- no
       separate user/member structure.
    ========================= */
    const [messages, setMessages] = useState<ChatMessage[]>(project.messages);

    /* Tasks tab filters */
    const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
    const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");

    useEffect(() => {
        const found = projects.find((p) => p.slug === slug) ?? projects[0];
        setTasks(found.tasks);
        setMembers(found.members);
        setDocuments(found.documents);
        setFiles(found.files);
        setMessages(found.messages);
        setStatusFilter("all");
        setPriorityFilter("all");
    }, [slug]);

    const filteredTasks = tasks.filter((t) => {
        const statusMatch = statusFilter === "all" || t.status === statusFilter;
        const priorityMatch = priorityFilter === "all" || t.priority === priorityFilter;
        return statusMatch && priorityMatch;
    });

    const tasksDone = tasks.filter((t) => t.status === "done").length;
    const tasksTotal = tasks.length;
    const progress = tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100);

    /* Drag and drop */
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

    const handleDrop = (columnKey: TaskStatus, e: DragEvent) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/plain") || draggingId;
        if (taskId) {
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, status: columnKey } : t))
            );
        }
        setDraggingId(null);
        setDragOverColumn(null);
    };

    /* Task modal (create / edit) */
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [modalTask, setModalTask] = useState<Task | null>(null);
    const [modalDefaultStatus, setModalDefaultStatus] = useState<TaskStatus>("todo");

    const openCreateModal = (status: TaskStatus) => {
        setModalMode("create");
        setModalTask(null);
        setModalDefaultStatus(status);
        setModalOpen(true);
    };

    const openEditModal = (task: Task) => {
        setModalMode("edit");
        setModalTask(task);
        setModalOpen(true);
    };

    const closeModal = () => setModalOpen(false);

    const saveTask = (task: Task) => {
        setTasks((prev) => {
            const exists = prev.some((t) => t.id === task.id);
            return exists ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task];
        });
        setModalOpen(false);
    };

    const deleteTask = (id: string) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setModalOpen(false);
    };

    const memberName = (initials: string) =>
        members.find((m) => m.initials === initials)?.name ?? initials;

    /* =========================
       MEMBERS TAB
       Detail modal (view a member + their tasks) and the
       add-member form. Stats are derived from the live `tasks`
       state -- never stored separately.
    ========================= */
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [addMemberOpen, setAddMemberOpen] = useState(false);

    const memberStats = (initials: string) => {
        const assignedTasks = tasks.filter((t) => t.assignee === initials);
        const completedTasks = assignedTasks.filter((t) => t.status === "done");
        return {
            assignedTasks,
            assigned: assignedTasks.length,
            completed: completedTasks.length,
            remaining: assignedTasks.length - completedTasks.length,
        };
    };

    const makeInitials = (name: string) => {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        const base =
            parts.length === 1
                ? parts[0].slice(0, 2)
                : parts[0][0] + parts[parts.length - 1][0];
        const upper = base.toUpperCase();

        if (!members.some((m) => m.initials === upper)) return upper;

        // Avoid colliding with an existing member's initials
        for (let i = 2; i <= 9; i++) {
            const candidate = `${upper[0]}${i}`;
            if (!members.some((m) => m.initials === candidate)) return candidate;
        }
        return `${upper}${members.length}`;
    };

    const addMember = (member: Omit<Member, "initials">) => {
        const newMember: Member = { ...member, initials: makeInitials(member.name) };
        setMembers((prev) => [...prev, newMember]);
        setAddMemberOpen(false);
    };

    const openMemberTask = (task: Task) => {
        setSelectedMember(null);
        openEditModal(task);
    };

    /* =========================
       DOCUMENTS TAB
       Search + type filter are local UI state (not persisted).
       Stats/counts are derived directly from `documents`.
    ========================= */
    const [docSearch, setDocSearch] = useState("");
    const [docTypeFilter, setDocTypeFilter] = useState<"all" | DocType>("all");
    const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(null);
    const [addDocumentOpen, setAddDocumentOpen] = useState(false);

    const filteredDocuments = documents.filter((doc) => {
        const query = docSearch.trim().toLowerCase();
        const matchesQuery =
            query.length === 0 ||
            doc.name.toLowerCase().includes(query) ||
            doc.description.toLowerCase().includes(query);
        const matchesType = docTypeFilter === "all" || doc.type === docTypeFilter;
        return matchesQuery && matchesType;
    });

    const today = () =>
        new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

    const addDocument = (doc: {
        name: string;
        description: string;
        type: DocType;
        owner: string;
        size?: string;
    }) => {
        const newDoc: ProjectDocument = {
            id: `d-${Date.now()}`,
            ...doc,
            createdAt: today(),
            updatedAt: today(),
        };
        setDocuments((prev) => [newDoc, ...prev]);
        setAddDocumentOpen(false);
    };

    /* =========================
       FILES TAB
       Same shape as the Documents tab handlers, but scoped to
       `files`/`ProjectFile` -- fully independent state.
    ========================= */
    const [fileSearch, setFileSearch] = useState("");
    const [fileCategoryFilter, setFileCategoryFilter] = useState<"all" | FileCategory>("all");
    const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
    const [uploadFileOpen, setUploadFileOpen] = useState(false);

    const filteredFiles = files.filter((file) => {
        const query = fileSearch.trim().toLowerCase();
        const matchesQuery =
            query.length === 0 ||
            file.name.toLowerCase().includes(query) ||
            (file.description ?? "").toLowerCase().includes(query);
        const matchesCategory =
            fileCategoryFilter === "all" || FILE_CATEGORY[file.type] === fileCategoryFilter;
        return matchesQuery && matchesCategory;
    });

    const addFile = (file: {
        name: string;
        type: FileType;
        size: string;
        uploadedBy: string;
        description?: string;
    }) => {
        const newFile: ProjectFile = {
            id: `f-${Date.now()}`,
            ...file,
            uploadedAt: today(),
        };
        setFiles((prev) => [newFile, ...prev]);
        setUploadFileOpen(false);
    };

    /* =========================
       CHAT TAB
       Sends as the current workspace user (Samayita Ray / "SR"),
       matching the identity already shown in the sidebar/topbar
       profile avatars across the app.
    ========================= */
    const sendChatMessage = (text: string) => {
        const newMessage: ChatMessage = {
            id: `m-${Date.now()}`,
            senderInitials: "SR",
            text,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMessage]);
    };

    return (
        <div className="projects-page">

            <aside className="projects-sidebar">

                <div className="brand">
                    <span>Collabsphere</span>
                    <small>ENT</small>
                </div>

                <div className="workspace">
                    <div className="workspace-logo">AC</div>

                    <div>
                        <strong>Acme Corp</strong>
                        <span>Enterprise workspace</span>
                    </div>

                    <span className="chevron">⌄</span>
                </div>

                <div className="nav-title">NAVIGATION</div>

                <nav>
                    <a href="#">Overview</a>
                    <a href="#" className="selected">
                        Projects
                        <span>4</span>
                    </a>
                    <a href="#">My Tasks</a>
                    <a href="#">Documents</a>
                    <a href="#">Files</a>
                    <a href="#">Messages</a>
                    <a href="#">Analytics</a>
                    <a href="#">Settings</a>
                </nav>

                <div className="profile">
                    <div className="profile-avatar">SR</div>

                    <div>
                        <strong>Samayita Ray</strong>
                        <span>Workspace Admin</span>
                    </div>
                </div>

            </aside>

            <main className="projects-main">

                <header className="topbar">

                    <div className="breadcrumb">
                        Workspace / Projects / <strong>{project.name}</strong>
                    </div>

                    <div className="topbar-actions">
                        <div className="search">
                            <span>⌕</span>
                            <input placeholder="Search anything..." />
                            <kbd>⌘ K</kbd>
                        </div>

                        <button className="notification">♢</button>

                        <div className="profile-avatar">SR</div>
                    </div>

                </header>

                <section className="content">

                    <Link to="/projects" className="back-link">
                        ← Back to Projects
                    </Link>

                    <div className="workspace-header">

                        <div className="workspace-header-main">

                            <div className="workspace-mark">{project.initials}</div>

                            <div className="workspace-title-block">

                                <div className="workspace-title-row">
                                    <h1>{project.name}</h1>

                                    <div
                                        className={`status ${project.status === "COMPLETED" ? "completed" : "active"
                                            }`}
                                    >
                                        <span />
                                        {project.status}
                                    </div>
                                </div>

                                <div className="workspace-category">{project.category}</div>

                                <p className="workspace-description">{project.description}</p>

                            </div>

                        </div>

                        <div className="workspace-header-side">

                            <div className="workspace-progress">
                                <div className="progress-header">
                                    <span>Progress</span>
                                    <strong>{progress}%</strong>
                                </div>

                                <div className="progress-bar">
                                    <div style={{ width: `${progress}%` }} />
                                </div>
                            </div>

                            <div className="workspace-due">
                                <span>
                                    ✓ <strong>{tasksDone}/{tasksTotal}</strong> tasks
                                </span>
                                <span>
                                    ◷ <strong>{project.date}</strong>
                                </span>
                            </div>

                            <div className="members">
                                {members.map((member) => (
                                    <div className="member" key={member.initials} title={member.name}>
                                        {member.initials}
                                    </div>
                                ))}
                            </div>

                        </div>

                    </div>

                    <div className="workspace-tabs">
                        {TABS.map((tab) => (
                            <button
                                key={tab}
                                className={activeTab === tab ? "active" : ""}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                                {tab === "Tasks" && <span>{tasksTotal}</span>}
                                {tab === "Members" && <span>{members.length}</span>}
                                {tab === "Chat" && <span>{messages.length}</span>}
                            </button>
                        ))}
                    </div>

                    {activeTab === "Overview" && (
                        <div className="overview-grid">

                            <div className="panel">
                                <h3>Recent activity</h3>

                                {activity.map((item, i) => (
                                    <div className="activity-item" key={i}>
                                        <div className="activity-dot" />
                                        <div>
                                            <div className="activity-text">{item.text}</div>
                                            <div className="activity-time">{item.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="panel">
                                <h3>Project details</h3>

                                <div className="stat-row">
                                    <span>Status</span>
                                    <span>{project.status}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Progress</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="stat-row">
                                    <span>Tasks completed</span>
                                    <span>{tasksDone}/{tasksTotal}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Due date</span>
                                    <span>{project.date}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Team size</span>
                                    <span>{members.length} members</span>
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === "Tasks" && (
                        <div className="tasks-tab">

                            <div className="tasks-toolbar">
                                <div className="status-filters">
                                    {STATUS_FILTERS.map((f) => (
                                        <button
                                            key={f.key}
                                            className={statusFilter === f.key ? "active" : ""}
                                            onClick={() => setStatusFilter(f.key)}
                                        >
                                            {f.label}
                                            <span>
                                                {f.key === "all"
                                                    ? tasks.length
                                                    : tasks.filter((t) => t.status === f.key).length}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <div className="tasks-toolbar-actions">
                                    <select
                                        className="priority-filter"
                                        value={priorityFilter}
                                        onChange={(e) =>
                                            setPriorityFilter(e.target.value as "all" | TaskPriority)
                                        }
                                        aria-label="Filter by priority"
                                    >
                                        {PRIORITY_FILTERS.map((f) => (
                                            <option key={f.key} value={f.key}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        className="add-task-button"
                                        onClick={() =>
                                            openCreateModal(statusFilter === "all" ? "todo" : statusFilter)
                                        }
                                    >
                                        + Add task
                                    </button>
                                </div>
                            </div>

                            {filteredTasks.length === 0 ? (
                                <div className="empty-state">
                                    <h3>No matching tasks</h3>
                                    <p>Try a different filter, or add a new task to this project.</p>
                                </div>
                            ) : (
                                <div className="task-table">
                                    <div className="task-table-header">
                                        <span />
                                        <span>Task</span>
                                        <span>Priority</span>
                                        <span>Status</span>
                                        <span>Due</span>
                                        <span>Assignee</span>
                                    </div>

                                    <div className="task-list">
                                        {filteredTasks.map((task) => (
                                            <div
                                                className={`task-row ${task.status === "done" ? "done" : ""}`}
                                                key={task.id}
                                                onClick={() => openEditModal(task)}
                                            >
                                                <div className={`task-check ${task.status === "done" ? "done" : ""}`} />

                                                <div className="task-row-main">
                                                    <div className="task-row-title">{task.title}</div>
                                                    {task.description && (
                                                        <div className="task-row-desc">{task.description}</div>
                                                    )}
                                                </div>

                                                <span className={`priority-pill ${task.priority}`}>
                                                    <span className="priority-dot" />
                                                    {task.priority}
                                                </span>

                                                <div className={`task-row-tag ${task.status}`}>
                                                    {TAG_LABEL[task.status]}
                                                </div>

                                                <div className="task-row-due">
                                                    {task.due ? `◷ ${task.due}` : "—"}
                                                </div>

                                                <div className="member" title={memberName(task.assignee)}>
                                                    {task.assignee}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {activeTab === "Board" && (
                        <div className="board">
                            {COLUMNS.map((column) => {
                                const columnTasks = tasks.filter((t) => t.status === column.key);

                                return (
                                    <div
                                        className={`board-column ${dragOverColumn === column.key ? "drag-over" : ""}`}
                                        key={column.key}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDragOverColumn(column.key);
                                        }}
                                        onDragLeave={() => {
                                            setDragOverColumn((current) => (current === column.key ? null : current));
                                        }}
                                        onDrop={(e) => handleDrop(column.key, e)}
                                    >

                                        <div className="column-header">
                                            <div className="column-title">
                                                <span className={`column-dot ${column.key}`} />
                                                {column.label}
                                            </div>

                                            <div className="column-header-actions">
                                                <div className="column-count">{columnTasks.length}</div>
                                                <button
                                                    type="button"
                                                    className="column-add"
                                                    onClick={() => openCreateModal(column.key)}
                                                    aria-label={`Add task to ${column.label}`}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        <div className="column-tasks">
                                            {columnTasks.length === 0 && (
                                                <div className="board-empty">No tasks yet</div>
                                            )}

                                            {columnTasks.map((task) => (
                                                <div
                                                    className={`task-card priority-${task.priority} ${draggingId === task.id ? "dragging" : ""
                                                        }`}
                                                    key={task.id}
                                                    draggable
                                                    onClick={() => openEditModal(task)}
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData("text/plain", task.id);
                                                        e.dataTransfer.effectAllowed = "move";
                                                        setDraggingId(task.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggingId(null);
                                                        setDragOverColumn(null);
                                                    }}
                                                >
                                                    <div className="task-card-top">
                                                        <span className={`priority-pill ${task.priority}`}>
                                                            <span className="priority-dot" />
                                                            {task.priority}
                                                        </span>
                                                    </div>

                                                    <p className="task-card-title">{task.title}</p>

                                                    {task.description && (
                                                        <p className="task-card-desc">{task.description}</p>
                                                    )}

                                                    <div className="task-card-footer">
                                                        <span className="task-card-due">
                                                            {task.due ? `◷ ${task.due}` : ""}
                                                        </span>
                                                        <div className="member" title={memberName(task.assignee)}>
                                                            {task.assignee}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {modalOpen && (
                        <TaskModal
                            mode={modalMode}
                            task={modalTask}
                            defaultStatus={modalDefaultStatus}
                            members={members}
                            onClose={closeModal}
                            onSave={saveTask}
                            onDelete={deleteTask}
                        />
                    )}

                    {selectedMember && (
                        <MemberDetailModal
                            member={selectedMember}
                            stats={memberStats(selectedMember.initials)}
                            onClose={() => setSelectedMember(null)}
                            onOpenTask={openMemberTask}
                        />
                    )}

                    {addMemberOpen && (
                        <AddMemberModal
                            onClose={() => setAddMemberOpen(false)}
                            onSave={addMember}
                        />
                    )}

                    {selectedDocument && (
                        <DocumentDetailModal
                            document={selectedDocument}
                            onClose={() => setSelectedDocument(null)}
                        />
                    )}

                    {addDocumentOpen && (
                        <AddDocumentModal
                            onClose={() => setAddDocumentOpen(false)}
                            onSave={addDocument}
                        />
                    )}

                    {selectedFile && (
                        <FileDetailModal
                            file={selectedFile}
                            onClose={() => setSelectedFile(null)}
                        />
                    )}

                    {uploadFileOpen && (
                        <AddFileModal
                            onClose={() => setUploadFileOpen(false)}
                            onSave={addFile}
                        />
                    )}

                    {activeTab === "Members" && (
                        <div className="members-tab">

                            <div className="members-tab-header">
                                <div>
                                    <h2>Project members</h2>
                                    <p>The people working on this project and their current workload.</p>
                                </div>

                                <button
                                    type="button"
                                    className="add-task-button"
                                    onClick={() => setAddMemberOpen(true)}
                                >
                                    + Add member
                                </button>
                            </div>

                            <div className="members-grid">
                                {members.map((member) => {
                                    const stats = memberStats(member.initials);
                                    const workload =
                                        stats.remaining === 0
                                            ? { label: "All caught up", className: "caught-up" }
                                            : stats.remaining <= 3
                                                ? { label: "On track", className: "on-track" }
                                                : { label: "Overloaded", className: "overloaded" };

                                    return (
                                        <button
                                            type="button"
                                            className="member-card"
                                            key={member.initials}
                                            onClick={() => setSelectedMember(member)}
                                        >
                                            <div className="member-card-top">
                                                <div className="profile-avatar">{member.initials}</div>
                                                <div className="member-card-identity">
                                                    <strong>{member.name}</strong>
                                                    <span>{member.role}</span>
                                                </div>
                                            </div>

                                            <div className="member-card-email">{member.email}</div>

                                            <div className="member-card-stats">
                                                <div className="member-card-stat">
                                                    <strong>{stats.assigned}</strong>
                                                    <span>Assigned</span>
                                                </div>
                                                <div className="member-card-stat">
                                                    <strong>{stats.completed}</strong>
                                                    <span>Completed</span>
                                                </div>
                                                <div className="member-card-stat">
                                                    <strong>{stats.remaining}</strong>
                                                    <span>Remaining</span>
                                                </div>
                                            </div>

                                            <div className={`workload-badge ${workload.className}`}>
                                                <span />
                                                {workload.label}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                        </div>
                    )}

                    {activeTab === "Documents" && (
                        <div className="documents-tab">

                            <div className="members-tab-header">
                                <div>
                                    <h2>Documents</h2>
                                    <p>Project documentation, specifications, meeting notes, and shared knowledge.</p>
                                </div>

                                <button
                                    type="button"
                                    className="add-task-button"
                                    onClick={() => setAddDocumentOpen(true)}
                                >
                                    + New document
                                </button>
                            </div>

                            <div className="tasks-toolbar">
                                <div className="search doc-search">
                                    <span>⌕</span>
                                    <input
                                        placeholder="Search documents..."
                                        value={docSearch}
                                        onChange={(e) => setDocSearch(e.target.value)}
                                    />
                                </div>

                                <div className="status-filters">
                                    {DOC_TYPE_FILTERS.map((f) => (
                                        <button
                                            key={f.key}
                                            className={docTypeFilter === f.key ? "active" : ""}
                                            onClick={() => setDocTypeFilter(f.key)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredDocuments.length === 0 ? (
                                <div className="empty-state">
                                    <h3>{documents.length === 0 ? "No documents yet" : "No matching documents"}</h3>
                                    <p>
                                        {documents.length === 0
                                            ? "Specs, notes, and shared knowledge for this project will show up here."
                                            : "Try a different search term or filter."}
                                    </p>
                                </div>
                            ) : (
                                <div className="doc-table">
                                    <div className="doc-table-header">
                                        <span />
                                        <span>Document</span>
                                        <span>Owner</span>
                                        <span>Updated</span>
                                        <span>Size</span>
                                    </div>

                                    <div className="doc-list">
                                        {filteredDocuments.map((doc) => (
                                            <div
                                                className="doc-row"
                                                key={doc.id}
                                                onClick={() => setSelectedDocument(doc)}
                                            >
                                                <div className={`doc-icon ${doc.type.toLowerCase()}`}>
                                                    {doc.type}
                                                </div>

                                                <div className="doc-row-main">
                                                    <div className="doc-row-title">{doc.name}</div>
                                                    <div className="doc-row-desc">{doc.description}</div>
                                                </div>

                                                <div className="doc-row-owner">{doc.owner}</div>

                                                <div className="doc-row-updated">◷ {doc.updatedAt}</div>

                                                <div className="doc-row-size">{doc.size ?? "—"}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {activeTab === "Files" && (
                        <div className="documents-tab">

                            <div className="members-tab-header">
                                <div>
                                    <h2>Files</h2>
                                    <p>Project assets, attachments, and shared files.</p>
                                </div>

                                <button
                                    type="button"
                                    className="add-task-button"
                                    onClick={() => setUploadFileOpen(true)}
                                >
                                    + Upload file
                                </button>
                            </div>

                            <div className="tasks-toolbar">
                                <div className="search doc-search">
                                    <span>⌕</span>
                                    <input
                                        placeholder="Search files..."
                                        value={fileSearch}
                                        onChange={(e) => setFileSearch(e.target.value)}
                                    />
                                </div>

                                <div className="status-filters">
                                    {FILE_CATEGORY_FILTERS.map((f) => (
                                        <button
                                            key={f.key}
                                            className={fileCategoryFilter === f.key ? "active" : ""}
                                            onClick={() => setFileCategoryFilter(f.key)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredFiles.length === 0 ? (
                                <div className="empty-state">
                                    <h3>{files.length === 0 ? "No files yet" : "No matching files"}</h3>
                                    <p>
                                        {files.length === 0
                                            ? "Upload files to keep project assets in one place."
                                            : "Try a different search term or filter."}
                                    </p>
                                </div>
                            ) : (
                                <div className="doc-table">
                                    <div className="doc-table-header">
                                        <span />
                                        <span>File</span>
                                        <span>Uploaded by</span>
                                        <span>Uploaded</span>
                                        <span>Size</span>
                                    </div>

                                    <div className="doc-list">
                                        {filteredFiles.map((file) => (
                                            <div
                                                className="doc-row"
                                                key={file.id}
                                                onClick={() => setSelectedFile(file)}
                                            >
                                                <div className={`doc-icon file-icon-${FILE_CATEGORY[file.type]}`}>
                                                    {file.type}
                                                </div>

                                                <div className="doc-row-main">
                                                    <div className="doc-row-title">{file.name}</div>
                                                    {file.description && (
                                                        <div className="doc-row-desc">{file.description}</div>
                                                    )}
                                                </div>

                                                <div className="doc-row-owner">{file.uploadedBy}</div>

                                                <div className="doc-row-updated">◷ {file.uploadedAt}</div>

                                                <div className="doc-row-size">{file.size}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {activeTab === "Chat" && (
                        <ProjectChat
                            members={members}
                            messages={messages}
                            onSend={sendChatMessage}
                        />
                    )}

                    {activeTab === "Activity" && (
                        <div className="panel">
                            {activity.map((item, i) => (
                                <div className="activity-item" key={i}>
                                    <div className="activity-dot" />
                                    <div>
                                        <div className="activity-text">{item.text}</div>
                                        <div className="activity-time">{item.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </section>

            </main>

        </div>
    );
}