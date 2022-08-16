using System.Text.Json.Serialization;

namespace Term2.Model; 

    public class IPAddress
    {
        [JsonPropertyName("ip")]
        public string IP{get;set;}
 
        [JsonPropertyName("geo-ip")]
        public string GeoIP{get;set;}
 
        [JsonPropertyName("API Help")]
        public string APIHelp{get;set;}
    }
