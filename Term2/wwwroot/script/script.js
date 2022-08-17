document.addEventListener('keydown', function (e) {
    if (e.keyCode == 9) {  
        e.preventDefault();
    }
});


function focusInput(id) {
    document.getElementById(id).focus();
}

function OnScrollEvent() {
    window.scrollTo(0,document.body.scrollHeight);
}
