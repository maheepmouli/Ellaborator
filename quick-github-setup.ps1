# Quick GitHub Setup - Interactive Script
Write-Host "=== Quick GitHub Repository Setup ===" -ForegroundColor Cyan
Write-Host ""

# Get GitHub username
$username = Read-Host "Enter your GitHub username"

if (-not $username) {
    Write-Host "Username is required. Exiting." -ForegroundColor Red
    exit 1
}

# Repository name
$repoName = "ellaborator"
Write-Host ""
Write-Host "Repository will be created as: $username/$repoName" -ForegroundColor Yellow
Write-Host ""

# Check if remote exists
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "Removing existing remote..." -ForegroundColor Yellow
    git remote remove origin
}

# Add remote
$repoUrl = "https://github.com/$username/$repoName.git"
Write-Host "Adding remote: $repoUrl" -ForegroundColor Cyan
git remote add origin $repoUrl

# Ensure we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    git branch -M main
}

Write-Host ""
Write-Host "=== IMPORTANT ===" -ForegroundColor Yellow
Write-Host "Please make sure you have created the repository on GitHub first!" -ForegroundColor Yellow
Write-Host "If you haven't, go to: https://github.com/new" -ForegroundColor Yellow
Write-Host "  - Name: $repoName" -ForegroundColor White
Write-Host "  - DO NOT initialize with README, .gitignore, or license" -ForegroundColor White
Write-Host ""
$ready = Read-Host "Have you created the repository? (y/n)"

if ($ready -ne "y") {
    Write-Host "Please create the repository first, then run this script again." -ForegroundColor Yellow
    exit 1
}

# Push to GitHub
Write-Host ""
Write-Host "Pushing code to GitHub..." -ForegroundColor Cyan
try {
    git push -u origin main
    Write-Host ""
    Write-Host "✓ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "Repository URL: https://github.com/$username/$repoName" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Error pushing. You may need to authenticate." -ForegroundColor Red
    Write-Host "Try running: git push -u origin main" -ForegroundColor Yellow
    Write-Host "Or use a Personal Access Token if prompted for password." -ForegroundColor Yellow
}
