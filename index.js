(function () {
    function $(key) {
        if (key.startsWith("#")) return document.querySelector(key);
        return document.querySelectorAll(key);
    }

    function Canvas(element) {
        this.canvas = element;
        this.context = element.getContext("2d");
    }
    Canvas.prototype.init = function (width, height, color) {
        this.setSize(width, height);
        if (color) {
            this.context.fillStyle = color;
            this.context.fillRect(0, 0, width, height);
        }
    }
    Canvas.prototype.setSize = function (width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }
    Canvas.prototype.calcImageFitSize = function (image) {
        let { naturalWidth, naturalHeight } = image;
        const { width, height } = this.canvas;
        const scale = naturalWidth / naturalHeight;
        if (naturalWidth > width) {
            naturalWidth = width;
            naturalHeight = width / scale;
        }
        if (naturalHeight > height) {
            naturalHeight = height;
            naturalWidth = height * scale;
        }
        return { width: naturalWidth, height: naturalHeight };
    }
    Canvas.prototype.clear = function (x, y, width, height) {
        if (width && height) {
            this.context.clearRect(x, y, width, height);
        } else {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        }
    }
    function RGBA(r, g, b, a) {
        this.rgba = [r, g, b, a];
        this.gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
        if (a == 0) this.gray = 255;
        this._index = -1;
    }
    RGBA.prototype.add = function (rgbaObj) {
        return new RGBA(...this.rgba.map((color, i) => {
            return color + rgbaObj.rgba[i];
        }));
    }
    RGBA.prototype.average = function (num) {
        return new RGBA(...this.rgba.map((color, i) => {
            return Math.floor(color / num);
        }));
    }
    RGBA.prototype.pushTo = function (container, startIndex) {
        for (let i = 0; i < 4; ++i) {
            container[startIndex + i] = this.rgba[i];
        }
    }
    function getImageData(data, width, height) {
        const imageData = new ImageData(width, height);
        var index = 0;
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                data[r][c].pushTo(imageData.data, index);
                index += 4;
            }
        }
        return imageData;
    }
    function Picture(imageData) {
        this.data = [];
        this.width = imageData.width;
        this.height = imageData.height;
        this.originData = imageData;
        var index = 0;
        for (let r = 0; r < this.height; r++) {
            const arr = [];
            for (let c = 0; c < this.width; c++) {
                arr.push(
                    new RGBA(imageData.data[index++],
                        imageData.data[index++],
                        imageData.data[index++],
                        imageData.data[index++])
                );
            }
            this.data.push(arr);
        }
    }
    Picture.prototype.average = function (r, c, width, height) {
        let rgba = new RGBA(0, 0, 0, 0);
        for (let i = 0; i < height && r + i < this.height; i++) {
            for (let j = 0; j < width && c + j < this.width; j++) {
                rgba = this.data[r + i][c + j].add(rgba);
            }
        }
        return rgba.average(width * height);
    }
    Picture.prototype.getImageData = function () {
        const imageData = new ImageData(this.width, this.height);
        var index = 0;
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                this.data[r][c].pushTo(imageData.data, index);
                index += 4;
            }
        }
        return imageData;
    }
    Picture.prototype.pixelate = function (pixelSize) {
        const data = [];
        for (let i = 0; i < this.height; ++i) {
            data.push(new Array(this.width));
        }
        for (let r = 0; r < this.height; r += pixelSize) {
            for (let c = 0; c < this.width; c += pixelSize) {
                const rgba = this.average(r, c, pixelSize, pixelSize);
                for (let i = 0; i < pixelSize && r + i < this.height; i++) {
                    for (let j = 0; j < pixelSize && c + j < this.width; j++) {
                        data[r + i][c + j] = rgba;
                    }
                }
            }
        }
        return getImageData(data, this.width, this.height);
    }
    Picture.prototype.compress = function (compressSize) {
        const data = [];
        for (let r = 0; r < this.height; r += compressSize) {
            const arr = [];
            for (let c = 0; c < this.width; c += compressSize) {
                arr.push(this.average(r, c, compressSize, compressSize));
            }
            data.push(arr);
        }
        return getImageData(data, Math.floor(this.width / compressSize), Math.floor(this.height / compressSize));
    }
    Picture.prototype.toStringArr = function () {
        const map = "@%M&8$OACL1!-:; ";
        const unit = 256 / map.length;
        var data = [];
        for (let r = 0; r < this.height; r++) {
            let str = ''
            for (let c = 0; c < this.width; c++) {
                str += map[Math.floor(this.data[r][c].gray / unit)];
            }
            data.push(str);
        }
        return data;
    }

    function showAssist(type) {
        const element = $(".assist")[0];
        element.style.visibility = "visible";
        element.dataset.type = type;
        const minSize = element.firstElementChild.min;
        element.firstElementChild.value = minSize;
        element.lastElementChild.innerText = minSize;
    }

    function hideAssist() {
        $(".assist")[0].style.visibility = "hidden";
    }

    function main() {
        const MAX_CANVAS_WIDTH = innerWidth * 0.8;
        const MAX_CANVAS_HEIGHT = innerHeight * 0.8;

        const canvas = new Canvas($("#canvas"));
        canvas.init(MAX_CANVAS_WIDTH, MAX_CANVAS_HEIGHT, "#ccc");

        var picture = null;

        function resizeImage() {
            const imageData = picture.getImageData();
            canvas.setSize(imageData.width, imageData.height);
            canvas.context.putImageData(imageData, 0, 0);
        }

        $("#upload-image-btn").onclick = function () {
            const input = $("#upload");
            input.click();
            input.onchange = function (e) {
                const image = new Image();
                image.onload = function () {
                    const { width, height } = canvas.calcImageFitSize(image);
                    canvas.setSize(width, height);
                    canvas.context.drawImage(image, 0, 0, width, height);
                    picture = new Picture(canvas.context.getImageData(0, 0, width, height))
                }
                image.src = URL.createObjectURL(e.target.files[0]);
            }
        }
        $("#pixelate-btn").onclick = function () {
            if (picture) {
                showAssist("pixelate");
                resizeImage();
            }
        }
        $("#compress-btn").onclick = function () {
            if (picture) {
                showAssist("compress");
                resizeImage();
            }
        }
        $("#stringfy-btn").onclick = function () {
            if (picture) {
                hideAssist();
                canvas.setSize(picture.width, picture.height);
                canvas.context.font = "2px serif";
                picture.toStringArr().forEach((it, idx) => {
                    canvas.context.fillText(it, 0, idx);
                })
            }
        }
        $("#range").oninput = function (e) {
            const size = e.target.value;
            $("#range-text").innerText = size;
        }
        $("#range").onchange = function (e) {
            const size = e.target.value;
            var imageData = null;
            switch (e.target.parentElement.dataset.type) {
                case "pixelate":
                    imageData = picture.pixelate(+size);
                    break;
                case "compress":
                    imageData = picture.compress(+size);
                    break;
                default:
                    break;
            }
            canvas.setSize(imageData.width, imageData.height);
            canvas.context.putImageData(imageData, 0, 0);
        }

    }
    main();
})();

//M&$8%RA3OC1!;:\"'-. 
//"M&$B%0eol1v!'=+;:.";
// "#&$B%eaovl+;:. ";
//"B&eavoL!,. ";
// #&$%*o!;.";
//"M&Dn%l+-,. "
//MN&$Beon%vl+;:.