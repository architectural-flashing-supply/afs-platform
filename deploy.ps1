# AFS Website Deploy Script
# Sequence: TypeScript check ? build ? Vercel deploy ? Playwright tests ? git push

param(
    [switch]$SkipTests,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "=== AFS Deployment Pipeline ===" -ForegroundColor Cyan

# Step 1: TypeScript Check
Write-Host "`n[1/5] TypeScript type check..." -ForegroundColor Yellow
pnpm tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript check failed" -ForegroundColor Red
    exit 1
}
Write-Host "? TypeScript check passed" -ForegroundColor Green

# Step 2: Build
Write-Host "`n[2/5] Building application..." -ForegroundColor Yellow
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "? Build succeeded" -ForegroundColor Green

# Step 3: Deploy to Vercel
Write-Host "`n[3/5] Deploying to Vercel production..." -ForegroundColor Yellow
vercel --prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "Vercel deployment failed" -ForegroundColor Red
    exit 1
}
Write-Host "? Vercel deployment succeeded" -ForegroundColor Green

# Step 4: Playwright Tests (unless skipped)
if (-not $SkipTests) {
    Write-Host "`n[4/5] Running Playwright tests..." -ForegroundColor Yellow
    npx playwright test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Playwright tests failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "? Playwright tests passed" -ForegroundColor Green
} else {
    Write-Host "`n[4/5] Skipping Playwright tests (--SkipTests flag set)" -ForegroundColor Yellow
}

# Step 5: Git commit and push
Write-Host "`n[5/5] Committing and pushing to GitHub..." -ForegroundColor Yellow
git add .
$commitMessage = "chore: deploy $(Get-Date -Format 'yyyy-MM-dd HHmmss')"
git commit -m "$commitMessage"
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed" -ForegroundColor Red
    exit 1
}
Write-Host "? Git commit and push succeeded" -ForegroundColor Green

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Cyan
