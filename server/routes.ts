import type { Express } from "express";
import { createServer, type Server } from "http";
import { inventoryService } from "./services/inventoryService";
import { orderService } from "./services/orderService";
import { githubService } from "./services/githubService";
import { 
  requireAdminAuth, 
  validateBody, 
  validateQuery, 
  validateParams,
  type AuthenticatedRequest 
} from "./middleware/auth";
import {
  createRepositorySchema,
  createIssueSchema,
  repositoryParamsSchema,
  paginationSchema,
  issueStateSchema,
  dateRangeSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Floral categories and subcategories
  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await inventoryService.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error getting categories:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  app.get("/api/admin/init-floral", async (req, res) => {
    try {
      const category = await inventoryService.initializeFloralCategories();
      res.json({ success: true, category });
    } catch (error) {
      console.error("Error initializing floral categories:", error);
      res.status(500).json({ error: "Failed to initialize categories" });
    }
  });

  // Get current sticker inventory count (exactly what's displayed in boxes)
  app.get("/api/inventory/count", async (req, res) => {
    try {
      const inventory = await inventoryService.getStickerInventoryCount();
      res.json(inventory);
    } catch (error) {
      console.error("Error getting inventory count:", error);
      res.status(500).json({ error: "Failed to get inventory count" });
    }
  });

  // Get all active stickers by category
  app.get("/api/stickers/active", async (req, res) => {
    try {
      const stickers = await inventoryService.getActiveStickers();
      res.json(stickers);
    } catch (error) {
      console.error("Error getting active stickers:", error);
      res.status(500).json({ error: "Failed to get stickers" });
    }
  });

  // Get stickers by category and subcategory
  app.get("/api/stickers/category/:category/subcategory/:subcategory", async (req, res) => {
    try {
      const { category, subcategory } = req.params;
      const stickers = await inventoryService.getStickersByCategoryAndSubcategory(category, subcategory);
      res.json(stickers);
    } catch (error) {
      console.error("Error getting stickers by category and subcategory:", error);
      res.status(500).json({ error: "Failed to get stickers" });
    }
  });

  // Add sticker to inventory (when adding to a box)
  app.post("/api/admin/stickers", async (req, res) => {
    try {
      const sticker = await inventoryService.addStickerToInventory(req.body);
      res.json(sticker);
    } catch (error) {
      console.error("Error adding sticker:", error);
      res.status(500).json({ error: "Failed to add sticker" });
    }
  });

  // Create order
  app.post("/api/orders", async (req, res) => {
    try {
      const order = await orderService.createOrder(req.body);
      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get daily orders for printing (today by default)
  app.get("/api/admin/daily-orders", async (req, res) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const orders = await orderService.getDailyOrders(date);
      res.json(orders);
    } catch (error) {
      console.error("Error getting daily orders:", error);
      res.status(500).json({ error: "Failed to get daily orders" });
    }
  });

  // Get daily registrations
  app.get("/api/admin/daily-registrations", async (req, res) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const registrations = await orderService.getDailyRegistrations(date);
      res.json(registrations);
    } catch (error) {
      console.error("Error getting daily registrations:", error);
      res.status(500).json({ error: "Failed to get registrations" });
    }
  });

  // Get complete daily business report
  app.get("/api/admin/daily-report", async (req, res) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const report = await orderService.generateDailyReport(date);
      res.json(report);
    } catch (error) {
      console.error("Error generating daily report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Get orders by date range
  app.get("/api/admin/orders-range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date required" });
      }
      
      const orders = await orderService.getOrdersByDateRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json(orders);
    } catch (error) {
      console.error("Error getting orders by range:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  // GitHub Integration Routes - All Protected by Admin Authentication
  
  // Get current authenticated GitHub user
  app.get("/api/github/user", requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await githubService.getCurrentUser();
      res.json(user);
    } catch (error) {
      console.error("Error getting GitHub user:", error);
      res.status(500).json({ error: "Failed to get GitHub user" });
    }
  });

  // Get user repositories
  app.get("/api/github/repositories", 
    requireAdminAuth, 
    validateQuery(paginationSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { page, per_page } = req.query as any;
        const repositories = await githubService.getUserRepositories(page, per_page);
        res.json(repositories);
      } catch (error) {
        console.error("Error getting repositories:", error);
        res.status(500).json({ error: "Failed to get repositories" });
      }
    }
  );

  // Create new repository
  app.post("/api/github/repositories", 
    requireAdminAuth, 
    validateBody(createRepositorySchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { name, description, private: isPrivate } = req.body;
        const repository = await githubService.createRepository(name, description, isPrivate);
        res.json(repository);
      } catch (error) {
        console.error("Error creating repository:", error);
        res.status(500).json({ error: "Failed to create repository" });
      }
    }
  );

  // Create new repository with current project code
  app.post("/api/github/repositories/with-code", 
    requireAdminAuth, 
    validateBody(createRepositorySchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { name, description, private: isPrivate } = req.body;
        const result = await githubService.createRepositoryWithCode(name, description, isPrivate);
        res.json(result);
      } catch (error) {
        console.error("Error creating repository with code:", error);
        res.status(500).json({ error: "Failed to create repository with code" });
      }
    }
  );

  // Initialize existing repository with current project code
  app.post("/api/github/repositories/:owner/:repo/initialize", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const result = await githubService.initializeRepository(owner, repo);
        res.json(result);
      } catch (error) {
        console.error("Error initializing repository:", error);
        res.status(500).json({ error: "Failed to initialize repository" });
      }
    }
  );

  // Get specific repository
  app.get("/api/github/repositories/:owner/:repo", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const repository = await githubService.getRepository(owner, repo);
        if (!repository) {
          return res.status(404).json({ error: "Repository not found" });
        }
        res.json(repository);
      } catch (error) {
        console.error("Error getting repository:", error);
        res.status(500).json({ error: "Failed to get repository" });
      }
    }
  );

  // Get repository commits
  app.get("/api/github/repositories/:owner/:repo/commits", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    validateQuery(paginationSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const { page } = req.query as any;
        const commits = await githubService.getCommits(owner, repo, page);
        res.json(commits);
      } catch (error) {
        console.error("Error getting commits:", error);
        res.status(500).json({ error: "Failed to get commits" });
      }
    }
  );

  // Get repository branches
  app.get("/api/github/repositories/:owner/:repo/branches", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const branches = await githubService.getBranches(owner, repo);
        res.json(branches);
      } catch (error) {
        console.error("Error getting branches:", error);
        res.status(500).json({ error: "Failed to get branches" });
      }
    }
  );

  // Get workflow runs
  app.get("/api/github/repositories/:owner/:repo/workflows", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const workflowRuns = await githubService.getWorkflowRuns(owner, repo);
        res.json(workflowRuns);
      } catch (error) {
        console.error("Error getting workflow runs:", error);
        res.status(500).json({ error: "Failed to get workflow runs" });
      }
    }
  );

  // Create deployment workflow
  app.post("/api/github/repositories/:owner/:repo/workflows/deploy", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const result = await githubService.createDeploymentWorkflow(owner, repo);
        res.json(result);
      } catch (error) {
        console.error("Error creating deployment workflow:", error);
        res.status(500).json({ error: "Failed to create deployment workflow" });
      }
    }
  );

  // Setup complete production deployment (workflow + dockerfile + dockerignore)
  app.post("/api/github/repositories/:owner/:repo/setup-deployment", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const result = await githubService.setupProductionDeployment(owner, repo);
        res.json(result);
      } catch (error) {
        console.error("Error setting up production deployment:", error);
        res.status(500).json({ error: "Failed to setup production deployment" });
      }
    }
  );

  // Create Dockerfile
  app.post("/api/github/repositories/:owner/:repo/dockerfile", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const result = await githubService.createDockerfile(owner, repo);
        res.json(result);
      } catch (error) {
        console.error("Error creating Dockerfile:", error);
        res.status(500).json({ error: "Failed to create Dockerfile" });
      }
    }
  );

  // Get repository issues
  app.get("/api/github/repositories/:owner/:repo/issues", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    validateQuery(issueStateSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const { state } = req.query as any;
        const issues = await githubService.getIssues(owner, repo, state);
        res.json(issues);
      } catch (error) {
        console.error("Error getting issues:", error);
        res.status(500).json({ error: "Failed to get issues" });
      }
    }
  );

  // Create repository issue
  app.post("/api/github/repositories/:owner/:repo/issues", 
    requireAdminAuth, 
    validateParams(repositoryParamsSchema), 
    validateBody(createIssueSchema), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const { title, body, labels } = req.body;
        const issue = await githubService.createIssue(owner, repo, title, body, labels);
        res.json(issue);
      } catch (error) {
        console.error("Error creating issue:", error);
        res.status(500).json({ error: "Failed to create issue" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}