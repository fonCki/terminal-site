using System.Runtime.CompilerServices;
using System.Text;
using static Term2.Services.Command;

namespace Term2.Services; 


public class Commands {
    
    //SET THE COMMANDS
    private string[] commandArray = new[] {"","about", "banner", "clear", "date", "email", "github", "help", "instagram", "linkedin"};
    
    
    public readonly List<Command?> _commandList = new List<Command?>();

    public Commands() {

        //CREATE A LIST OF COMMANDS WITH ALL THE COMMANDS IN THE ARRAY
        foreach (var comm in commandArray) {
            _commandList.Add(new Command(comm, $"Opening {comm}...", ""));
        }
        
        //SET RESPONSES DIFFERENTS THAN OPPENING
        _commandList.Find(c => c.Name.Equals("help")).Response = HelpResponse();
        _commandList.Find(c => c.Name.Equals("about")).Response = AboutResponse();
        _commandList.Find(c => c.Name.Equals("")).Response = "";
        // _commandList.Find(c => c.Name.Equals(string.IsNullOrWhiteSpace)).Response = "";

        //SET THE COMMANDS WITH RESPECTIVE LINKS
        _commandList.Find(c => c.Name.Equals("email")).Link = "mailto:alfonso@ridao.ar";
        _commandList.Find(c => c.Name.Equals("github")).Link = "https://github.com/fonCki";
        _commandList.Find(c => c.Name.Equals("instagram")).Link = "https://www.instagram.com/alfonsoridao/";
        _commandList.Find(c => c.Name.Equals("linkedin")).Link = "https://www.linkedin.com/in/alfonsoridao";

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