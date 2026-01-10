# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal portfolio website styled as an interactive terminal, built with Blazor WebAssembly (.NET 6.0). Users can type commands like `help`, `about`, `github`, etc., to navigate and interact with the site.

Live site: https://alfonso.ridao.ar

## Build & Run Commands

```bash
# Build the project
dotnet build Term2/Term2.csproj

# Run in development mode (hot reload)
dotnet watch run --project Term2/Term2.csproj

# Build for production
dotnet publish Term2/Term2.csproj -c Release -o release

# The published output goes to release/wwwroot/
```

## Deployment

Deployed via AWS Amplify. The `amplify.yml` configuration installs .NET 6.0 SDK and publishes to `release/wwwroot/`.

## Architecture

### Entry Point
- `Term2/Program.cs` - Registers services (`Commands`, `IApiClientService`) and initializes the Blazor WebAssembly app

### Core Components

**Pages/Index.razor** - Main page containing:
- Command history management
- Terminal input handling (execute, tab-complete, arrow key history navigation)
- Routing commands to their responses

**Shared/Terminal.razor** - Input component for the terminal prompt
- Handles keyboard events (Enter, Tab, Escape, Arrow keys)
- Displays user IP and prompt styling

**Shared/Response.razor** - Renders command output using a switch statement to determine which component to display (`Photo`, `Banner`, `Date`, `WhoAmI`, etc.)

### Command System

**Services/Commands.cs** - Central command registry
- `commandArray` defines available commands: `about`, `banner`, `clear`, `date`, `email`, `github`, `help`, `instagram`, `linkedin`, `repo`, `whoami`
- Each command has a `Name`, `Response` (HTML string), and optional `Link` (opens in new tab)

**Services/Command.cs** - Command data model with Name, Response, and Link properties

### External API Integration

**Services/ApiClientService.cs** implements `IApiClientService`:
- `GetUserIPAsync()` - Fetches user IP from ipify.org
- `GetLocationAsync()` - Gets country from ipapi.co
- `GetDateEventsAsync()` - Fetches "on this day" events from byabbe.se

**Model/Event.cs** - Data model for Wikipedia historical events

### JavaScript Interop

**wwwroot/script/script.js** provides:
- `focusInput(id)` - Focuses terminal input
- `OnScrollEvent()` - Auto-scrolls to bottom after each command
- Tab key prevention (default browser behavior)

## Adding a New Command

1. Add command name to `commandArray` in `Services/Commands.cs`
2. Set the response: `_commandList.Find(c => c!.Name.Equals("yourcommand"))!.Response = "HTML response";`
3. Optionally set a link: `_commandList.Find(c => c!.Name.Equals("yourcommand"))!.Link = "https://...";`
4. If the command needs a custom component, add a case in `Shared/Response.razor`'s switch statement
