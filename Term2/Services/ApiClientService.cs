using Term2.Model;
using Newtonsoft.Json.Linq;

namespace Term2.Services; 

public class ApiClientService : IApiClientService{
    
    private readonly IHttpClientFactory _httpClientFactory;
 
    public ApiClientService(IHttpClientFactory httpClientfactory) {
        _httpClientFactory = httpClientfactory;
    }
 
    public async Task<string> GetUserIPAsync() {
        using HttpClient client = new();
        HttpResponseMessage response = await client.GetAsync($"https://jsonip.com");
        string content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) {
            throw new Exception($"Error: {response.StatusCode}, {content}");
        }
        JObject result = JObject.Parse(content);
        return result["ip"].Value<string>();
    }

    public async Task<string> GetLocationAsync(string userIp) {
        using HttpClient client = new();
        HttpResponseMessage response = await client.GetAsync($"http://ip-api.com/json/{userIp}");
        string content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) {
            throw new Exception($"Error: {response.StatusCode}, {content}");
        }
        JObject result = JObject.Parse(content);
        return result["country"].Value<string>();
    }

    // public async Task<UserGeolocation> GetLocationAsync(string userIp) { 
    //         string path = $"{userIp}?access_key=8179536fb7e7383b93cedbc818945ff1";
    //         var client = _httpClientFactory.CreateClient("Location");
    //         return await client.GetFromJsonAsync<UserGeolocation>(path);
    // }

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
        List<Event> events = result["events"].Value<JArray>().ToObject<List<Event>>();
        return events;
    }
}