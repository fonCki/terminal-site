using Term2.Model;

namespace Term2.Services; 

public class ApiClientService : IApiClientService{
    
    private readonly IHttpClientFactory _httpClientFactory;
 
    public ApiClientService(IHttpClientFactory httpClientfactory) {
        _httpClientFactory = httpClientfactory;
    }
 
    public async Task<IPAddress> GetUserIPAsync()
    {
        var client =  _httpClientFactory.CreateClient("IP");
        return await client.GetFromJsonAsync<IPAddress>("/");
    }

    public async Task<UserGeolocation> GetLocationAsync(string userIp) { 
            string path = $"{userIp}?access_key=8179536fb7e7383b93cedbc818945ff1";
            var client = _httpClientFactory.CreateClient("Location");
            return await client.GetFromJsonAsync<UserGeolocation>(path);
    }
}