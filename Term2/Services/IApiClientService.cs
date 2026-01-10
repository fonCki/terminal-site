
using Term2.Model;

namespace Term2.Services;

public interface IApiClientService {
    Task<List<Event>> GetDateEventsAsync();
    Task<string> GetUserIPAsync();
    Task<string> GetLocationAsync();
    Task<LocationData?> GetLocationDetailsAsync();

    // Chat with digital twin
    Task<string> SendChatMessageAsync(string message, List<ChatMessage>? history);

    // Analytics logging
    Task LogVisitAsync(string ip, LocationData? location = null);
    Task LogCommandAsync(string ip, string command);
    Task LogChatAsync(string ip, string userMessage, string botResponse, string sessionId);
}