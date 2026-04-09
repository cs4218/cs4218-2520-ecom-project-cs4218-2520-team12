# [Your Name], [Your Student ID]
# Volume Testing - Run All
# Milestone 3 - Non-Functional Testing

param(
  [string]$BaseUrl = $env:BASE_URL
)

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = 'http://localhost:6060/api/v1'
}

if ([string]::IsNullOrWhiteSpace($env:AUTH_TOKEN) -and ([string]::IsNullOrWhiteSpace($env:AUTH_EMAIL) -or [string]::IsNullOrWhiteSpace($env:AUTH_PASSWORD))) {
  Write-Error 'Set AUTH_TOKEN, or set both AUTH_EMAIL and AUTH_PASSWORD.'
  exit 1
}

if ([string]::IsNullOrWhiteSpace($env:ADMIN_TOKEN) -and ([string]::IsNullOrWhiteSpace($env:ADMIN_EMAIL) -or [string]::IsNullOrWhiteSpace($env:ADMIN_PASSWORD))) {
  Write-Error 'Set ADMIN_TOKEN, or set both ADMIN_EMAIL and ADMIN_PASSWORD.'
  exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Running volume test suite against $BaseUrl"

Write-Host '1) Protected Routes'
k6 run --env BASE_URL=$BaseUrl --env AUTH_EMAIL=$env:AUTH_EMAIL --env AUTH_PASSWORD=$env:AUTH_PASSWORD --env ADMIN_EMAIL=$env:ADMIN_EMAIL --env ADMIN_PASSWORD=$env:ADMIN_PASSWORD --env AUTH_TOKEN=$env:AUTH_TOKEN --env ADMIN_TOKEN=$env:ADMIN_TOKEN "$ScriptDir\protected-routes-volume.js"

Write-Host '2) Orders'
k6 run --env BASE_URL=$BaseUrl --env AUTH_EMAIL=$env:AUTH_EMAIL --env AUTH_PASSWORD=$env:AUTH_PASSWORD --env ADMIN_EMAIL=$env:ADMIN_EMAIL --env ADMIN_PASSWORD=$env:ADMIN_PASSWORD --env AUTH_TOKEN=$env:AUTH_TOKEN --env ADMIN_TOKEN=$env:ADMIN_TOKEN "$ScriptDir\orders-volume.js"

Write-Host '3) Profile'
k6 run --env BASE_URL=$BaseUrl --env AUTH_EMAIL=$env:AUTH_EMAIL --env AUTH_PASSWORD=$env:AUTH_PASSWORD --env AUTH_TOKEN=$env:AUTH_TOKEN "$ScriptDir\profile-volume.js"

Write-Host '4) Admin View Users'
k6 run --env BASE_URL=$BaseUrl --env ADMIN_EMAIL=$env:ADMIN_EMAIL --env ADMIN_PASSWORD=$env:ADMIN_PASSWORD --env ADMIN_TOKEN=$env:ADMIN_TOKEN "$ScriptDir\admin-users-volume.js"

Write-Host 'All volume tests completed.'
