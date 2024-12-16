document.body.innerHTML = `
<h1>Hello, world!</h1>

<div id="click"> CLICK </div>

<script>
docuement.querySelector("click").click = () => {
  fetch("/oas")
}
</script>

`;
