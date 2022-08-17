
using Term2.Model;

namespace Term2.Services;

public interface IApiClientService {
    Task<List<Event>> GetDateEventsAsync();
    Task<string> GetUserIPAsync();
    Task<string> GetLocationAsync(string userIp);
}