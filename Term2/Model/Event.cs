using System.Text.Json.Serialization;

namespace Term2.Model; 

public class Event {
    public class Wiki {
        public string? Title { get; set; }
        public string? Wikipedia { get; set; }
    }
    public string? Year { get; set; }
    public string? Description { get; set; }
    public Wiki[]? Wikipedia { get; set; }
}