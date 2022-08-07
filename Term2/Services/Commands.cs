using System.Runtime.CompilerServices;
using System.Text;
using static Term2.Services.Command;

namespace Term2.Services; 


public class Commands {
    public readonly List<Command?> _commandList = new List<Command?>();

    public Commands() {
        
        Command? about = new Command("about",
            "the response about About",
            "");
        
        Command? banner = new Command("banner",
            "the response about banner",
            "");
        
        Command? clear = new Command("clear",
            "the response about clear",
            "");
        
        Command? date = new Command("date",
            "the response about date",
            "");
        
        Command? email = new Command("email",
            "the response about email",
            "mailto:alfonso@ridao.ar");
        
        Command? github = new Command("github",
            "the response about github",
            "https://github.com/fonCki");
        
        Command? help = new Command("help",
            "the response about help",
            "");
        
        Command? instagram = new Command("instagram",
            "the response about instagram",
            "https://www.instagram.com/alfonsoridao/");
        
        Command? linkedin = new Command("linkedin",
            "the response about linkedin",
            "https://www.linkedin.com/in/alfonsoridao");
        
        Command? empty = new Command("",
            "",
            "");
        
        _commandList.Add(about);
        _commandList.Add(banner);
        _commandList.Add(clear);
        _commandList.Add(date);
        _commandList.Add(email);
        _commandList.Add(github);
        _commandList.Add(help);
        _commandList.Add(instagram);
        _commandList.Add(linkedin);
        _commandList.Add(empty);
    }
}