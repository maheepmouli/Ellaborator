# GitHub Repository Creation and Push Script
# This script will help create a GitHub repository and push your code

param(
    [string]$RepoName = "ellaborator",
    [string]$Description = "ELABORATOR - Urban Mobility & Safety Metrics Platform",
    [string]$GitHubUsername = "",
    [string]$GitHubToken = ""
)

Write-Host "=== GitHub Repository Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check git configuration
$gitName = git config user.name 2>$null
$gitEmail = git config user.email 2>$null

if (-not $gitName -or -not $gitEmail) {
    Write-Host "Git is not configured. Configuring with defaults..." -ForegroundColor Yellow
    git config user.name "ELLABORATOR User"
    git config user.email "user@ellaborator.local"
    Write-Host "✓ Git configured" -ForegroundColor Green
}

# Check if remote already exists
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "Remote 'origin' already exists: $existingRemote" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to remove it and create a new one? (y/n)"
    if ($overwrite -eq "y") {
        git remote remove origin
    } else {
        Write-Host "Keeping existing remote. Exiting." -ForegroundColor Yellow
        exit 0
    }
}

# Try to create repo via GitHub API if token is provided
if ($GitHubToken -and $GitHubUsername) {
    Write-Host "Attempting to create repository via GitHub API..." -ForegroundColor Cyan
    
    $body = @{
        name = $RepoName
        description = $Description
        private = $false
        auto_init = $false
    } | ConvertTo-Json
    
    $headers = @{
        "Authorization" = "token $GitHubToken"
        "Accept" = "application/vnd.github.v3+json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "✓ Repository created successfully: $($response.html_url)" -ForegroundColor Green
        
        # Add remote and push
        git remote add origin $response.clone_url
        Write-Host "✓ Remote added" -ForegroundColor Green
        
        git push -u origin main
        Write-Host "✓ Code pushed to GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Repository URL: $($response.html_url)" -ForegroundColor Cyan
        exit 0
    } catch {
        Write-Host "Failed to create via API: $_" -ForegroundColor Red
        Write-Host "Falling back to manual method..." -ForegroundColor Yellow
    }
}

# Manual method - open GitHub and provide instructions
Write-Host "=== Manual Repository Creation ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Since GitHub CLI is not available, please create the repository manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open your browser to: https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name: $RepoName" -ForegroundColor White
Write-Host "3. Description: $Description" -ForegroundColor White
Write-Host "4. Choose Public or Private" -ForegroundColor White
Write-Host "5. DO NOT initialize with README, .gitignore, or license" -ForegroundColor White
Write-Host "6. Click 'Create repository'" -ForegroundColor White
Write-Host ""

if (-not $GitHubUsername) {
    $GitHubUsername = Read-Host "Enter your GitHub username"
}

Write-Host ""
Write-Host "After creating the repository, press Enter to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Add remote and push
$repoUrl = "https://github.com/$GitHubUsername/$RepoName.git"
Write-Host ""
Write-Host "Adding remote and pushing code..." -ForegroundColor Cyan

try {
    git remote add origin $repoUrl
    Write-Host "✓ Remote added" -ForegroundColor Green
    
    # Ensure we're on main branch
    $currentBranch = git branch --show-current
    if ($currentBranch -ne "main") {
        git branch -M main
    }
    
    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    git push -u origin main
    
    Write-Host ""
    Write-Host "✓ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "Repository URL: https://github.com/$GitHubUsername/$RepoName" -ForegroundColor Cyan
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to push manually:" -ForegroundColor Yellow
    Write-Host "  git remote add origin $repoUrl" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor White
}
