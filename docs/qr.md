# QR

Stick some text or a url in. You get a QR code back as SVG or PNG. No canvas, nothing stored.

GET /api/v1/qr?text=... Optional size, ecc, margin, colors, and format.

```
/api/v1/qr?text=https%3A%2F%2Fthreethirds.dev&size=256
```

- text is required after trim, max 1024 characters
- size is optional, 64 to 1024 px, default 256
- ecc is optional: L, M, Q, or H, default M
- margin is the quiet zone in modules, 0 to 8, default 2
- dark and light are the module and background colors. hex, plain rgb(), or a short named color. junk with url( or ; gets rejected
- format defaults to svg. format=png returns image/png. format=json hands back ok, text, size, ecc, svg, and a dataUri
- png needs a color we can turn into rgb (hex, rgb(), or a common name like black/white)
- hit the route with no text and you get a small help payload
- bad params are 400
- image responses are cached for an hour
- svg/png responses send Content-Disposition so the browser can save them as qr.svg / qr.png
- works as an img src: /api/v1/qr?text=hello
