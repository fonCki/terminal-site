using Term2.Shared;

namespace Term2.Services; 

public class Command {
     public string Name { get; set; }
     public string Response { get; set; }
     public string Link { get; set; }
     
     public Command(string name, string response, string link) {
          Name = name;
          Response = response;
          Link = link;
     }
     
     public Command(string command) {
         Name = "";
         Link = "";
         Response = ($"Command not found: {command}. Try 'help' to get started.");
     }
     
}