using System.Runtime.CompilerServices;
using System.Text;
using Term2.Model;
using static Term2.Services.Command;


namespace Term2.Services; 


public class Commands {

    //SET THE COMMANDS
    private string[] commandArray = new[] {"","about", "banner", "clear", "date", "email", "github", "help", "instagram", "linkedin", "repo","whoami"};
    
    public readonly List<Command?> _commandList = new List<Command?>();

    private IApiClientService ApiClientService;

    public Commands(IApiClientService apiClientService) {

         ApiClientService = apiClientService;

        //CREATE A LIST OF COMMANDS WITH ALL THE COMMANDS IN THE ARRAY
        foreach (var comm in commandArray) {
            _commandList.Add(new Command(comm, $"Opening {comm}...", ""));
        }
        
        //SET RESPONSES DIFFERENTS THAN OPPENING
        _commandList.Find(c => c.Name.Equals("help")).Response = HelpResponse();
        _commandList.Find(c => c.Name.Equals("about")).Response = AboutResponse();
        _commandList.Find(c => c.Name.Equals("")).Response = "";
        _commandList.Find(c => c.Name.Equals("whoami")).Response = WhoAmIResponse().Result;
        _commandList.Find(c => c.Name.Equals("banner")).Response = BannerResponse();


        //SET THE COMMANDS WITH RESPECTIVE LINKS
        
        _commandList.Find(c => c.Name.Equals("email")).Link = "mailto:alfonso@ridao.ar";
        _commandList.Find(c => c.Name.Equals("github")).Link = "https://github.com/fonCki";
        _commandList.Find(c => c.Name.Equals("instagram")).Link = "https://www.instagram.com/alfonsoridao/";
        _commandList.Find(c => c.Name.Equals("linkedin")).Link = "https://www.linkedin.com/in/alfonsoridao";
        _commandList.Find(c => c.Name.Equals("repo")).Link = "https://github.com/fonCki/Term2";

    }

    private string BannerResponse() {
        return (@"<p> Type 'help' to see a list of available commands." +
                "<p>-<p> <br>" +
                "This project is my own version of term. based on <b>@m4tt72</b>'s version. <br><br>" +
                "type 'repo' to find out the repository. <br>" +
                "made with Blazor <br><br> ");
    }

    private async Task<string> WhoAmIResponse() {
          //  IPAddress ipAddress = await ApiClientService.GetUserIPAsync();
          // UserGeolocation location = await ApiClientService.GetLocationAsync(ipAddress.IP);
          // return (ipAddress + location.city + location.time_zone);
         return ("Hola");
    }

    private string HelpResponse() {
        string available = "";
        foreach (var command in commandArray) {
            if (!string.IsNullOrEmpty(command)) {
                available += command + ", ";
            }
        }
        available = available.Remove(available.Length - 2);
        return (@"<p> Available Commands:  <br>  " +
                 "<p>" + available + "<p> <br>"  +
                "[tab]  complete command <br>" +
                "[esc]  cancel command </p>");
    }

    private string AboutResponse() {
        return (@"<p>This is an <b>about</b> response</p>");
    }
    
}