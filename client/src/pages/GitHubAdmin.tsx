import { Helmet } from "react-helmet";
import GitHubManager from "@/components/admin/GitHubManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Rocket, GitBranch, Settings } from "lucide-react";

export default function GitHubAdmin() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>GitHub Integration - Admin Panel | Sticker Store</title>
        <meta name="description" content="Manage GitHub integration, repositories, and automated deployments for your sticker store." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Github className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">GitHub Integration</h1>
              <p className="text-muted-foreground">Manage your repositories and automate deployments</p>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Repository Management</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Repositories</div>
              <p className="text-xs text-muted-foreground">
                Create and manage your GitHub repositories
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Automated Deployment</CardTitle>
              <Rocket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">CI/CD</div>
              <p className="text-xs text-muted-foreground">
                Set up automated workflows and deployments
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Integration Status</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Connected</div>
              <p className="text-xs text-muted-foreground">
                GitHub integration is active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main GitHub Manager */}
        <GitHubManager />
      </div>
    </div>
  );
}