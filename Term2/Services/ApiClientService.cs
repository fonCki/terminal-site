using Term2.Model;
using Newtonsoft.Json.Linq;
using System.Text;
using System.Text.Json;

namespace Term2.Services;

public class ApiClientService : IApiClientService{

    // API Gateway endpoints (eu-west-2)
    private const string API_CHAT_URL = "https://7sv2xijrq7.execute-api.eu-west-2.amazonaws.com/api/chat";
    private const string API_LOG_URL = "https://7sv2xijrq7.execute-api.eu-west-2.amazonaws.com/api/log";
    
    public async Task<string> GetUserIPAsync() {
        using HttpClient client = new();
        HttpResponseMessage response = await client.GetAsync($"https://api.ipify.org?format=json");
        string content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) {
            return "#unknown-user";
        }
        JObject result = JObject.Parse(content);
        return result["ip"]!.Value<string>()!;
    }

    public async Task<string> GetLocationAsync() {
        using HttpClient client = new();
        HttpResponseMessage response = await client.GetAsync($"https://ipapi.co/json/");
        string content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) {
            return "Planet Earth";
        }
        JObject result = JObject.Parse(content);
        return result["country_name"]!.Value<string>()!;
    }

    // Get full location details for logging
    public async Task<LocationData?> GetLocationDetailsAsync() {
        try {
            using HttpClient client = new();
            HttpResponseMessage response = await client.GetAsync($"https://ipapi.co/json/");
            string content = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode) {
                return null;
            }
            JObject result = JObject.Parse(content);
            return new LocationData {
                Country = result["country_name"]?.Value<string>() ?? "",
                CountryCode = result["country_code"]?.Value<string>() ?? "",
                City = result["city"]?.Value<string>() ?? "",
                Region = result["region"]?.Value<string>() ?? ""
            };
        }
        catch {
            return null;
        }
    }
    
    public async Task<List<Event>> GetDateEventsAsync() {
        int month = DateTime.Now.Month;
        int day = DateTime.Now.Day;
        using HttpClient client = new();
        HttpResponseMessage response = await client.GetAsync($"https://byabbe.se/on-this-day/{month}/{day}/events.json");
        string content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) {
            throw new Exception($"Error: {response.StatusCode}, {content}");
        }
        JObject result = JObject.Parse(content);
        List<Event> events = result["events"]!.Value<JArray>()!.ToObject<List<Event>>()!;
        return events!;
    }

    // Chat with digital twin
    public async Task<string> SendChatMessageAsync(string message, List<ChatMessage>? history) {
        using HttpClient client = new();

        var requestBody = new {
            message = message,
            history = history ?? new List<ChatMessage>()
        };

        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json"
        );

        try {
            HttpResponseMessage response = await client.PostAsync(API_CHAT_URL, content);
            string responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode) {
                return "Sorry, I'm having trouble connecting right now. Try again later.";
            }

            JObject result = JObject.Parse(responseContent);
            return result["response"]?.Value<string>() ?? "No response received.";
        }
        catch {
            return "Connection error. Please try again.";
        }
    }

    // Analytics logging - fire and forget, don't block UI
    public async Task LogVisitAsync(string ip, LocationData? location = null) {
        if (location != null) {
            await LogAsync(new {
                type = "visit",
                ip,
                location = new {
                    country = location.Country,
                    countryCode = location.CountryCode,
                    city = location.City,
                    region = location.Region
                }
            });
        } else {
            await LogAsync(new { type = "visit", ip });
        }
    }

    public async Task LogCommandAsync(string ip, string command) {
        await LogAsync(new { type = "command", ip, command });
    }

    public async Task LogChatAsync(string ip, string userMessage, string botResponse, string sessionId) {
        await LogAsync(new { type = "chat", ip, userMessage, botResponse, sessionId });
    }

    private async Task LogAsync(object data) {
        try {
            using HttpClient client = new();
            var content = new StringContent(
                JsonSerializer.Serialize(data),
                Encoding.UTF8,
                "application/json"
            );
            // Fire and forget - don't await or handle errors to avoid blocking UI
            await client.PostAsync(API_LOG_URL, content);
        }
        catch {
            // Silently ignore logging errors - analytics shouldn't break the site
        }
    }
}