using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Term2.Data;
using Term2.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();
builder.Services.AddSingleton<WeatherForecastService>();
builder.Services.AddScoped<Commands>();
builder.Services.AddScoped<IApiClientService,ApiClientService>();

builder.Services.AddHttpClient("IP",(options) => {
    options.BaseAddress = new Uri("https://jsonip.com");
});


builder.Services.AddHttpClient("Location", options => {
    options.BaseAddress = new Uri("http://api.ipstack.com");
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment()) {
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();