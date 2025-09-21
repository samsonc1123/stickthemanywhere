import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GitBranch, GitCommit, GitPullRequest, Github, Package, Play, Settings, Users, AlertCircle, CheckCircle, Plus, Rocket } from "lucide-react";

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  public_repos: number;
  followers: number;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
  language?: string;
  stargazers_count: number;
  forks_count: number;
}

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author?: {
    login: string;
    avatar_url: string;
  };
}

interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string;
  created_at: string;
  head_branch: string;
  event: string;
}

export default function GitHubManager() {
  const { toast } = useToast();
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [createRepoOpen, setCreateRepoOpen] = useState(false);
  const [repoForm, setRepoForm] = useState({ name: "", description: "", private: false });

  // GitHub user query
  const { data: githubUser, isLoading: userLoading } = useQuery<GitHubUser>({
    queryKey: ["/api/github/user"],
    retry: false
  });

  // Repositories query
  const { data: repositories, isLoading: reposLoading } = useQuery<Repository[]>({
    queryKey: ["/api/github/repositories"],
    enabled: !!githubUser
  });

  // Selected repository details
  const { data: repoDetails } = useQuery({
    queryKey: ["/api/github/repositories", selectedRepo?.full_name],
    queryFn: () => selectedRepo ? 
      fetch(`/api/github/repositories/${selectedRepo.full_name}`).then(res => res.json()) : null,
    enabled: !!selectedRepo
  });

  // Commits for selected repository
  const { data: commits } = useQuery<Commit[]>({
    queryKey: ["/api/github/repositories", selectedRepo?.full_name, "commits"],
    queryFn: () => selectedRepo ? 
      fetch(`/api/github/repositories/${selectedRepo.full_name}/commits`).then(res => res.json()) : [],
    enabled: !!selectedRepo
  });

  // Workflow runs for selected repository
  const { data: workflowRuns } = useQuery<{ workflow_runs: WorkflowRun[] }>({
    queryKey: ["/api/github/repositories", selectedRepo?.full_name, "workflows"],
    queryFn: () => selectedRepo ? 
      fetch(`/api/github/repositories/${selectedRepo.full_name}/workflows`).then(res => res.json()) : { workflow_runs: [] },
    enabled: !!selectedRepo
  });

  // Create repository mutation
  const createRepoMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; private: boolean }) =>
      apiRequest("POST", "/api/github/repositories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/github/repositories"] });
      setCreateRepoOpen(false);
      setRepoForm({ name: "", description: "", private: false });
      toast({
        title: "Repository Created",
        description: "Your new repository has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Repository",
        description: error.message || "Failed to create repository",
        variant: "destructive",
      });
    }
  });

  // Create repository with code mutation
  const createRepoWithCodeMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; private: boolean }) =>
      apiRequest("POST", "/api/github/repositories/with-code", data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/github/repositories"] });
      setCreateRepoOpen(false);
      setRepoForm({ name: "", description: "", private: false });
      toast({
        title: "Repository Created with Code",
        description: `Repository created and initialized with ${result.initialization.filesUploaded} files.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Repository with Code",
        description: error.message || "Failed to create repository with code",
        variant: "destructive",
      });
    }
  });

  // Initialize repository mutation
  const initializeRepoMutation = useMutation({
    mutationFn: () => selectedRepo ?
      apiRequest("POST", `/api/github/repositories/${selectedRepo.full_name}/initialize`) : Promise.reject("No repository selected"),
    onSuccess: (result: any) => {
      toast({
        title: "Repository Initialized",
        description: `Repository initialized with ${result.filesUploaded} files.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Initializing Repository",
        description: error.message || "Failed to initialize repository",
        variant: "destructive",
      });
    }
  });

  // Create deployment workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: () => selectedRepo ?
      apiRequest("POST", `/api/github/repositories/${selectedRepo.full_name}/workflows/deploy`) : Promise.reject("No repository selected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/github/repositories", selectedRepo?.full_name, "workflows"] });
      toast({
        title: "Deployment Workflow Created",
        description: "GitHub Actions deployment workflow has been set up.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Workflow",
        description: error.message || "Failed to create deployment workflow",
        variant: "destructive",
      });
    }
  });

  // Setup complete production deployment mutation
  const setupProductionMutation = useMutation({
    mutationFn: () => selectedRepo ?
      apiRequest("POST", `/api/github/repositories/${selectedRepo.full_name}/setup-deployment`) : Promise.reject("No repository selected"),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/github/repositories", selectedRepo?.full_name, "workflows"] });
      toast({
        title: "Production Deployment Setup Complete",
        description: "CI/CD workflow, Dockerfile, and .dockerignore have been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Setting Up Production Deployment",
        description: error.message || "Failed to setup production deployment",
        variant: "destructive",
      });
    }
  });

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
          <p className="mt-2 text-muted-foreground">Connecting to GitHub...</p>
        </div>
      </div>
    );
  }

  if (!githubUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            GitHub Connection Required
          </CardTitle>
          <CardDescription>
            Please ensure your GitHub integration is properly configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The GitHub integration needs to be set up to manage repositories and deployments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="github-manager">
      {/* GitHub User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <img 
              src={githubUser.avatar_url} 
              alt={githubUser.name || githubUser.login}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h3 className="font-semibold">{githubUser.name || githubUser.login}</h3>
              <p className="text-sm text-muted-foreground">@{githubUser.login}</p>
              <div className="flex gap-4 mt-1">
                <span className="text-xs text-muted-foreground">
                  {githubUser.public_repos} repositories
                </span>
                <span className="text-xs text-muted-foreground">
                  {githubUser.followers} followers
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Repository Management */}
      <Tabs defaultValue="repositories" className="w-full">
        <TabsList>
          <TabsTrigger value="repositories" data-testid="tab-repositories">Repositories</TabsTrigger>
          <TabsTrigger value="deployment" data-testid="tab-deployment">Deployment</TabsTrigger>
        </TabsList>

        <TabsContent value="repositories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Your Repositories</h3>
            <Dialog open={createRepoOpen} onOpenChange={setCreateRepoOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-repo">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Repository
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Repository</DialogTitle>
                  <DialogDescription>
                    Create a new GitHub repository for your project.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="repo-name">Repository Name</Label>
                    <Input
                      id="repo-name"
                      data-testid="input-repo-name"
                      value={repoForm.name}
                      onChange={(e) => setRepoForm({ ...repoForm, name: e.target.value })}
                      placeholder="my-awesome-project"
                    />
                  </div>
                  <div>
                    <Label htmlFor="repo-description">Description (optional)</Label>
                    <Textarea
                      id="repo-description"
                      data-testid="input-repo-description"
                      value={repoForm.description}
                      onChange={(e) => setRepoForm({ ...repoForm, description: e.target.value })}
                      placeholder="A brief description of your project"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="repo-private"
                      data-testid="switch-repo-private"
                      checked={repoForm.private}
                      onCheckedChange={(checked) => setRepoForm({ ...repoForm, private: checked })}
                    />
                    <Label htmlFor="repo-private">Private repository</Label>
                  </div>
                </div>
                <DialogFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    data-testid="button-create-empty-repo"
                    onClick={() => createRepoMutation.mutate(repoForm)}
                    disabled={!repoForm.name || createRepoMutation.isPending || createRepoWithCodeMutation.isPending}
                  >
                    {createRepoMutation.isPending ? "Creating..." : "Create Empty"}
                  </Button>
                  <Button
                    type="submit"
                    data-testid="button-create-repo-with-code"
                    onClick={() => createRepoWithCodeMutation.mutate(repoForm)}
                    disabled={!repoForm.name || createRepoWithCodeMutation.isPending || createRepoMutation.isPending}
                  >
                    {createRepoWithCodeMutation.isPending ? "Creating with Code..." : "Create with Current Code"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {reposLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                      <div className="h-3 bg-muted rounded w-full"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : repositories && repositories.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {repositories.map((repo) => (
                <Card 
                  key={repo.id} 
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedRepo?.id === repo.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedRepo(repo)}
                  data-testid={`card-repo-${repo.name}`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold truncate">{repo.name}</h4>
                        {repo.private && <Badge variant="secondary">Private</Badge>}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {repo.language && (
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            {repo.language}
                          </span>
                        )}
                        <span>⭐ {repo.stargazers_count}</span>
                        <span>🔀 {repo.forks_count}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Github className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No repositories found</h3>
                <p className="text-muted-foreground">
                  Create your first repository to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="deployment" className="space-y-4">
          {selectedRepo ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Deployment for {selectedRepo.name}
                  </CardTitle>
                  <CardDescription>
                    Manage automated deployments and CI/CD workflows
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      onClick={() => initializeRepoMutation.mutate()}
                      disabled={initializeRepoMutation.isPending}
                      data-testid="button-initialize-repo"
                      variant="outline"
                    >
                      <Package className="h-4 w-4 mr-2" />
                      {initializeRepoMutation.isPending ? "Uploading Code..." : "Initialize with Current Code"}
                    </Button>
                    <Button 
                      onClick={() => setupProductionMutation.mutate()}
                      disabled={setupProductionMutation.isPending}
                      data-testid="button-setup-production"
                    >
                      <Rocket className="h-4 w-4 mr-2" />
                      {setupProductionMutation.isPending ? "Setting up..." : "Setup Complete CI/CD"}
                    </Button>
                    <Button 
                      onClick={() => createWorkflowMutation.mutate()}
                      disabled={createWorkflowMutation.isPending}
                      data-testid="button-setup-deployment"
                      variant="outline"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {createWorkflowMutation.isPending ? "Setting up..." : "Setup Workflow Only"}
                    </Button>
                  </div>

                  {workflowRuns?.workflow_runs && workflowRuns.workflow_runs.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Recent Workflow Runs</h4>
                      <div className="space-y-2">
                        {workflowRuns.workflow_runs.slice(0, 5).map((run) => (
                          <div key={run.id} className="flex items-center justify-between p-2 rounded border">
                            <div className="flex items-center gap-2">
                              {run.conclusion === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : run.conclusion === 'failure' ? (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <Play className="h-4 w-4 text-yellow-600" />
                              )}
                              <span className="text-sm">{run.head_branch}</span>
                            </div>
                            <Badge variant={
                              run.conclusion === 'success' ? 'default' : 
                              run.conclusion === 'failure' ? 'destructive' : 'secondary'
                            }>
                              {run.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {commits && commits.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitCommit className="h-5 w-5" />
                      Recent Commits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {commits.slice(0, 5).map((commit) => (
                        <div key={commit.sha} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                          {commit.author && (
                            <img 
                              src={commit.author.avatar_url} 
                              alt={commit.author.login}
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {commit.commit.message.split('\n')[0]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              by {commit.commit.author.name} • {new Date(commit.commit.author.date).toLocaleDateString()}
                            </p>
                          </div>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {commit.sha.substring(0, 7)}
                          </code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Settings className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Select a Repository</h3>
                <p className="text-muted-foreground">
                  Choose a repository from the Repositories tab to manage deployments.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}