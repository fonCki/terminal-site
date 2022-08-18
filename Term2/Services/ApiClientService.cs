using Term2.Model;
using Newtonsoft.Json.Linq;

namespace Term2.Services; 

public class ApiClientService : IApiClientService{
    
    public async Task<string> GetUserIPAsync() {
        using HttpClient client = new();
        HttpResponseMessage response = await client.GetAsync($"https://jsonip.com");
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
}