$.fn.simpleColorPicker = function(options) {
    var defaults = {
        imagesPerLine: 8,
        images: ['test.jpg', 'test.png'],
        showEffect: '',
        hideEffect: '',
        onChangeColor: false
    };

    var opts = $.extend(defaults, options);

    return this.each(function() {
        var txt = $(this);

        var imagesMarkup = '';

        var prefix = txt.attr('id').replace(/-/g, '') + '_';

        for(var i = 0; i < opts.images.length; i++){
            var item = opts.images[i];

            var breakLine = '';
            if (i % opts.imagesPerLine == 0)
                breakLine = 'clear: both; ';

            if (i > 0 && breakLine && $.browser && $.browser.msie && $.browser.version <= 7) {
                breakLine = '';
                imagesMarkup += '<li style="float: none; clear: both; overflow: hidden; background-color: #fff; display: block; height: 1px; line-height: 1px; font-size: 1px; margin-bottom: -2px;"></li>';
            }

            imagesMarkup += '<li id="' + prefix + 'color-' + i + '" class="color-box" style="' + breakLine + 'background-color: ' + item + '" title="' + item + '"></li>';
        }

        var box = $('<div id="' + prefix + 'color-picker" class="color-picker" style="position: absolute; left: 0px; top: 0px;"><ul>' + imagesMarkup + '</ul><div style="clear: both;"></div></div>');
        $('body').append(box);
        box.hide();

        box.find('li.color-box').click(function() {
            if (txt.is('input')) {
              txt.val(opts.images[this.id.substr(this.id.indexOf('-') + 1)]);
              txt.blur();
            }
            if ($.isFunction(defaults.onChangeColor)) {
              defaults.onChangeColor.call(txt, opts.images[this.id.substr(this.id.indexOf('-') + 1)]);
            }
            hideBox(box);
        });

        $('body').live('click', function() {
            hideBox(box);
        });

        box.click(function(event) {
            event.stopPropagation();
        });

        var positionAndShowBox = function(box) {
          var pos = txt.offset();
          var left = pos.left + txt.outerWidth() - box.outerWidth();
          if (left < pos.left) left = pos.left;
          box.css({ left: left, top: (pos.top + txt.outerHeight()) });
          showBox(box);
        }

        txt.click(function(event) {
          event.stopPropagation();
          if (!txt.is('input')) {
            // element is not an input so probably a link or div which requires the color box to be shown
            positionAndShowBox(box);
          }
        });

        txt.focus(function() {
          positionAndShowBox(box);
        });

        function hideBox(box) {
            if (opts.hideEffect == 'fade')
                box.fadeOut();
            else if (opts.hideEffect == 'slide')
                box.slideUp();
            else
                box.hide();
        }

        function showBox(box) {
            if (opts.showEffect == 'fade')
                box.fadeIn();
            else if (opts.showEffect == 'slide')
                box.slideDown();
            else
                box.show();
        }
    });
};
