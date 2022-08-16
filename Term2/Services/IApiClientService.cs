
using Term2.Model;

namespace Term2.Services; 

public interface IApiClientService {
        Task<IPAddress> GetUserIPAsync();
        Task<UserGeolocation> GetLocationAsync(string userIp);
}