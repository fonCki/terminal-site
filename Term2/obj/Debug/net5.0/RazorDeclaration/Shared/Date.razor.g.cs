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
#line 1 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Date.razor"
using Term2.Model;

#line default
#line hidden
#nullable disable
#nullable restore
#line 2 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Date.razor"
using System.Text.Json;

#line default
#line hidden
#nullable disable
#nullable restore
#line 3 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Date.razor"
using Newtonsoft.Json.Linq;

#line default
#line hidden
#nullable disable
#nullable restore
#line 4 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Date.razor"
using Term2.Services;

#line default
#line hidden
#nullable disable
    public partial class Date : Microsoft.AspNetCore.Components.ComponentBase
    {
        #pragma warning disable 1998
        protected override void BuildRenderTree(Microsoft.AspNetCore.Components.Rendering.RenderTreeBuilder __builder)
        {
        }
        #pragma warning restore 1998
#nullable restore
#line 12 "/Users/alfonsoridao/Projects/RiderProjects/Term2/Term2/Shared/Date.razor"
       

    private Event Event { get; set; }
    
    protected async override Task OnInitializedAsync() {
        List<Event> List = await ApiClientService.GetDateEventsAsync();
        Event = List[new Random().Next(0, List.Count)];
    }

    protected async override Task OnAfterRenderAsync(bool firstRender) {
        await jsRuntime.InvokeVoidAsync("OnScrollEvent");
    }


#line default
#line hidden
#nullable disable
        [global::Microsoft.AspNetCore.Components.InjectAttribute] private IApiClientService ApiClientService { get; set; }
        [global::Microsoft.AspNetCore.Components.InjectAttribute] private IJSRuntime jsRuntime { get; set; }
    }
}
#pragma warning restore 1591
