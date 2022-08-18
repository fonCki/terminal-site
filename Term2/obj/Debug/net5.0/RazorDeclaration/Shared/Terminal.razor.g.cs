// <auto-generated/>
#pragma warning disable 1591
#pragma warning disable 0414
#pragma warning disable 0649
#pragma warning disable 0169

namespace Term2.Shared
{
    #line hidden
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Components;
#nullable restore
#line 1 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using System.Net.Http;

#line default
#line hidden
#nullable disable
#nullable restore
#line 2 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using System.Net.Http.Json;

#line default
#line hidden
#nullable disable
#nullable restore
#line 3 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Microsoft.AspNetCore.Components.Forms;

#line default
#line hidden
#nullable disable
#nullable restore
#line 4 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Microsoft.AspNetCore.Components.Routing;

#line default
#line hidden
#nullable disable
#nullable restore
#line 5 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Microsoft.AspNetCore.Components.Web;

#line default
#line hidden
#nullable disable
#nullable restore
#line 6 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Microsoft.AspNetCore.Components.Web.Virtualization;

#line default
#line hidden
#nullable disable
#nullable restore
#line 7 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Microsoft.AspNetCore.Components.WebAssembly.Http;

#line default
#line hidden
#nullable disable
#nullable restore
#line 8 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Microsoft.JSInterop;

#line default
#line hidden
#nullable disable
#nullable restore
#line 9 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Term2;

#line default
#line hidden
#nullable disable
#nullable restore
#line 10 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/_Imports.razor"
using Term2.Shared;

#line default
#line hidden
#nullable disable
#nullable restore
#line 1 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Terminal.razor"
using System.Collections;

#line default
#line hidden
#nullable disable
#nullable restore
#line 2 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Terminal.razor"
using Term2.Model;

#line default
#line hidden
#nullable disable
#nullable restore
#line 3 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Terminal.razor"
using Term2.Services;

#line default
#line hidden
#nullable disable
    public partial class Terminal : Microsoft.AspNetCore.Components.ComponentBase
    {
        #pragma warning disable 1998
        protected override void BuildRenderTree(Microsoft.AspNetCore.Components.Rendering.RenderTreeBuilder __builder)
        {
        }
        #pragma warning restore 1998
#nullable restore
#line 15 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Terminal.razor"
       
    
    [Parameter] public Action<string, bool>? Execute { get; set; }
    
    [Parameter] public Action<string>? Cache { get; set; }
    
    [Parameter] public Action<string>? FindHistory { get; set; }
    
    [Parameter] public Action<string>? TabSearch { get; set; }
    
    [Parameter] public string Ip { get; set; }
    
    [Parameter] public string? Command { get; set; }
    
    [Parameter] public bool Ronly { get; set; }
    
    [Parameter] public string? ID { get; set; }
    
    


    private void RunCommand(KeyboardEventArgs e) {
        Console.WriteLine(e.Code);
        if (e.Code.Equals("ArrowUp") || e.Code.Equals("ArrowDown")) {
            FindHistory?.Invoke(e.Code);
        }
        if (e.Code == "Enter" || e.Code == "NumpadEnter") {
            Execute?.Invoke(Command!, Ronly);
        }
        if (e.Code == "Escape") {
            Cache?.Invoke("");
        }
        if (e.Code == "Tab") {
            TabSearch?.Invoke(Command!);
        }
        
    }

    public void RefreshValue(ChangeEventArgs e) {
        Command = e.Value?.ToString();
        Cache?.Invoke(Command!);
    }

#line default
#line hidden
#nullable disable
        [global::Microsoft.AspNetCore.Components.InjectAttribute] private IApiClientService _apiClientService { get; set; }
        [global::Microsoft.AspNetCore.Components.InjectAttribute] private IJSRuntime jsRuntime { get; set; }
    }
}
#pragma warning restore 1591
