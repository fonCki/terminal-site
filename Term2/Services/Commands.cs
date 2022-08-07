using System.Text;

namespace Term2.Services; 

public class Commands {
    public bool Execute(string command) {
        switch (command.ToLower()) {
            case "instagram": {
                                RunInstagram();
                                break;
            }
            case "linkedin": {
                                RunLinkedin();
                                break;
            }
            case "email": {
                                RunEmail();
                                break;
            }
            default: return false;
        }

        return true;
    }

    private void RunEmail() {
        Console.WriteLine("email - BABBBB");
    }

    private void RunLinkedin() {
        Console.WriteLine("linkedin - BABBBB");
    }

    private void RunInstagram() {
        Console.WriteLine("instagram - BABBBB");
    }
}