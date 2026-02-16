# Deployment Guide: GitHub & Vercel Setup

This guide will help you connect your ELLABORATOR project to GitHub and deploy it on Vercel.

## Prerequisites

- Git installed (already done ✓)
- GitHub account
- Vercel account (free tier available)

## Step 1: Configure Git (Required)

Before making commits, you need to configure your git identity. Run these commands in your terminal:

```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

Replace with your actual GitHub email and name.

## Step 2: Create GitHub Repository

Since GitHub CLI is not installed, follow these steps:

### Option A: Using GitHub Website (Recommended)

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name it: `ELLABORATOR` (or your preferred name)
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

### Option B: Install GitHub CLI (Alternative)

If you prefer using CLI:

1. Install GitHub CLI from: https://cli.github.com/
2. Run: `gh auth login`
3. Then run: `gh repo create ELLABORATOR --public --source=. --remote=origin --push`

## Step 3: Connect Local Repository to GitHub

After creating the repository on GitHub, run these commands:

```bash
cd C:\Users\lione\Downloads\ELLABORATOR

# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/ELLABORATOR.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

If you haven't made the initial commit yet, first run:

```bash
git add .
git commit -m "Initial commit: ELLABORATOR project"
```

## Step 4: Deploy to Vercel

### Method 1: Using Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in (or create an account)
2. Click "Add New Project"
3. Import your GitHub repository:
   - Click "Import Git Repository"
   - Select your `ELLABORATOR` repository
   - Click "Import"
4. Configure the project:
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (already set in vercel.json)
   - **Output Directory**: `dist` (already set in vercel.json)
   - **Install Command**: `npm install` (default)
5. Click "Deploy"
6. Wait for deployment to complete (usually 1-2 minutes)
7. Your app will be live at: `https://your-project-name.vercel.app`

### Method 2: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   cd C:\Users\lione\Downloads\ELLABORATOR
   vercel
   ```

4. Follow the prompts to link your project

## Step 5: Automatic Deployments

Once connected:
- Every push to the `main` branch will automatically trigger a new deployment
- Vercel will build and deploy your app automatically
- You'll get a preview URL for each deployment

## Troubleshooting

### Git Authentication Issues

If you encounter authentication issues when pushing:

1. Use a Personal Access Token:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate a new token with `repo` permissions
   - Use the token as your password when pushing

2. Or use SSH:
   ```bash
   git remote set-url origin git@github.com:YOUR_USERNAME/ELLABORATOR.git
   ```

### Vercel Build Errors

- Check that `vercel.json` is in the root directory
- Ensure all dependencies are in `package.json`
- Check the build logs in Vercel dashboard for specific errors

## Next Steps

- Set up environment variables in Vercel if your app needs them
- Configure a custom domain (available in Vercel project settings)
- Set up preview deployments for pull requests

---

**Note**: The `vercel.json` configuration file has already been created for you with the correct settings for a Vite React application.
