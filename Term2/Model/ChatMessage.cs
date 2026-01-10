using System.Text.Json.Serialization;

namespace Term2.Model;

public class ChatMessage {
    [JsonPropertyName("role")]
    public string Role { get; set; } = "";  // "user" or "assistant"

    [JsonPropertyName("content")]
    public string Content { get; set; } = "";
}
