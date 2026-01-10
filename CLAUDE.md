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

---

## Future Enhancement: Smart Knowledge Retrieval for Digital Twin

**Goal:** Make the digital twin answer detailed questions about CV, education, projects, etc. by giving Gemini tools to search documents stored in S3.

### Architecture

```
User asks: "Tell me about your bachelor's degree"
     ↓
Gemini decides to call: search_background("bachelor", "education")
     ↓
Lambda fetches: s3://terminal-site-private/education.txt
     ↓
Gemini responds with specific details
```

### S3 Document Structure

```
s3://terminal-site-private/
  ├── persona.txt        (personality, style - already exists)
  ├── cv.txt             (work experience, skills summary)
  ├── education.txt      (degrees, courses, certifications)
  ├── projects.txt       (detailed project descriptions)
  └── skills.txt         (technical skills, tools, languages)
```

### Lambda Changes (chat-handler/index.js)

```javascript
// 1. Define tools for Gemini
const tools = [{
  functionDeclarations: [{
    name: "search_background",
    description: "Search Alfonso's background info (CV, education, projects, skills)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
        category: {
          type: "string",
          enum: ["cv", "education", "projects", "skills"],
          description: "Which document to search"
        }
      },
      required: ["category"]
    }
  }]
}];

// 2. Pass tools to model
const chat = model.startChat({
  history: geminiHistory,
  tools: tools
});

// 3. Handle function calls in response
const result = await chat.sendMessage(userMessage);
const response = result.response;

// Check if Gemini wants to call a function
const functionCall = response.candidates[0]?.content?.parts?.find(p => p.functionCall);
if (functionCall) {
  const { name, args } = functionCall.functionCall;

  // Fetch document from S3
  const docContent = await getDocument(args.category); // e.g., education.txt

  // Send function result back to Gemini
  const result2 = await chat.sendMessage([{
    functionResponse: {
      name: name,
      response: { content: docContent }
    }
  }]);

  return result2.response.text();
}
```

### Implementation Steps

1. Create document files locally with detailed info
2. Upload documents to S3: `aws s3 cp education.txt s3://terminal-site-private/`
3. Update Lambda with function calling logic
4. Test with specific questions
5. Deploy

### Documents to Prepare

- **cv.txt**: Full work history, responsibilities, achievements
- **education.txt**: Bachelor details, master's, courses, certifications, grades
- **projects.txt**: Each project with tech stack, challenges, outcomes
- **skills.txt**: Programming languages, frameworks, tools, proficiency levels
