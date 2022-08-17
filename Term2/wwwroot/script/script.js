document.addEventListener('onkeypress', function (e) {
    console.log(e);
});


function focusInput(id) {
    document.getElementById(id).focus();
}

// function OnScrollEvent(id) {
//     document.documentElement.scrollTop = 100;
// }

function OnScrollEvent() {
    window.scrollTo(0,document.body.scrollHeight);
}

function invokeTabKey() {
    // get the active element when Enter was pressed and 
    // if it is an input, focus the next input
    // NOTE: You cannot really trigger the browser event -
    //       even if you do, the browser won't execute the action 
    //       (such as focusing the next input) so you have to define the action
    var currInput = document.activeElement;
    if (currInput.tagName.toLowerCase() == "input") {
        var inputs = document.getElementsByTagName("input");
        var currInput = document.activeElement;
        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i] == currInput) {
                var next = inputs[i + 1];
                if (next && next.focus) {
                    next.focus();
                }
                break;
            }
        }
    }
}