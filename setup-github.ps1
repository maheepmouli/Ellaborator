# GitHub Setup Script for ELLABORATOR
# Run this script after configuring your git identity

Write-Host "=== GitHub Repository Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if git is configured
$gitName = git config user.name 2>$null
$gitEmail = git config user.email 2>$null

if (-not $gitName -or -not $gitEmail) {
    Write-Host "Git is not configured. Please run these commands first:" -ForegroundColor Yellow
    Write-Host "  git config --global user.name `"Your Name`"" -ForegroundColor White
    Write-Host "  git config --global user.email `"your-email@example.com`"" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit and configure git first..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Git is configured:" -ForegroundColor Green
Write-Host "  Name: $gitName" -ForegroundColor White
Write-Host "  Email: $gitEmail" -ForegroundColor White
Write-Host ""

# Check if already committed
$commitStatus = git log --oneline -1 2>$null
if (-not $commitStatus) {
    Write-Host "Making initial commit..." -ForegroundColor Cyan
    git add .
    git commit -m "Initial commit: ELLABORATOR project"
    Write-Host "✓ Initial commit created" -ForegroundColor Green
} else {
    Write-Host "Repository already has commits" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Create a new repository on GitHub:" -ForegroundColor Yellow
Write-Host "   - Go to: https://github.com/new" -ForegroundColor White
Write-Host "   - Name it: ELLABORATOR" -ForegroundColor White
Write-Host "   - DO NOT initialize with README, .gitignore, or license" -ForegroundColor White
Write-Host "   - Click 'Create repository'" -ForegroundColor White
Write-Host ""
Write-Host "2. After creating the repository, run these commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/ELLABORATOR.git" -ForegroundColor White
Write-Host "   git branch -M main" -ForegroundColor White
Write-Host "   git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "   (Replace YOUR_USERNAME with your actual GitHub username)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Then deploy to Vercel:" -ForegroundColor Yellow
Write-Host "   - Go to: https://vercel.com/new" -ForegroundColor White
Write-Host "   - Import your GitHub repository" -ForegroundColor White
Write-Host "   - Click 'Deploy'" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see: DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
