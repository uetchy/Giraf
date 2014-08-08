$video = $("#video")
$backVideo = $("<video>")
gifjsWorkerDist = "js/gifjs/dist/gif.worker.js"

preset = ["""
var imageData = context.getImageData(0, 0, resultWidth, resultHeight);
var data = imageData.data;

for (i=0; i < data.length; i+=4) {
    var black = 0.34*data[i] + 0.5*data[i+1] + 0.16*data[i+2];
    data[i] = black;
    data[i+1] = black;
    data[i+2] = black;
}
context.putImageData(imageData, 0, 0);
""","""
var imageData = context.getImageData(0, 0, resultWidth, resultHeight);
var data = imageData.data;
var gain = 5; //数字が大きくなるとコントラストが強くなる

for (i=0; i < data.length; i++) {
    data[i] = 255 / (1 + Math.exp((128 - data[i]) / 128.0 * gain));
}
context.putImageData(imageData, 0, 0);
""","""
var imageData = context.getImageData(0, 0, resultWidth, resultHeight);
var data = imageData.data;
var diff = 30; //数字が大きくなるとより明るくなる

for (i=0; i < data.length; i++) {
    data[i] += diff;
}
context.putImageData(imageData, 0, 0);
""","""
var imageData = context.getImageData(0, 0, resultWidth, resultHeight);
var data = imageData.data;
var temp = 1.3; //1より大きくなると赤っぽく、小さくなると青っぽくなる

for (i=0; i < data.length; i+=4) {
    data[i] *= temp;    // red
    data[i+2] /= temp;  // blue
}
context.putImageData(imageData, 0, 0);
""","""
var text = "ちくわ大明神";
var x = 0;
var y = resultHeight / 2;

context.font = "bold 48px sans-serif";
context.fillStyle = "rgba(255, 131, 0, 0.7)";
context.fillText(text, x, y);
"""]

$ ->
  rendering = false
  fileHandler = new FileHandler
    $container: $("#drop_here")
    $file_input: $("#form_video")
  settings = new Settings

  $(fileHandler)
  .on 'enter', ->
    $('#drop_here').addClass 'active'
  .on 'leave', ->
    $('#drop_here').removeClass 'active'
  .on 'data_url_prepared', ->
    $('#drop_here').removeClass 'active'
    $('#drop_here').remove()

  loadVideo = (url) ->
    deferred = $.Deferred()
    $video.attr "src", url
    $backVideo.attr "src", url
    $video.one 'canplay', ->
      $video.removeClass "hidden"
      deferred.resolve $video
    $video.one 'error', (error) ->
      deferred.fail error

    deferred.promise()

  timelines = new Timelines

  $("#timeline_holder").sortable
    axis: "x"
    update: ->
      timelines.updateOrder()

  $(fileHandler).bind "data_url_prepared", (event, urls) ->
    (loadVideo urls[0]).done (image_url) ->
      # --- video loaded ---
      thumbnails = new Thumbnails
      settings.disable false
      $("#capture").removeClass "disabled"

      #$(".thumbnail").each ->
        #c = $(this).get(0)
        #c.width = video.videoWidth
        #c.height = video.videoHeight

      #thumbnails.push(new Thumbnail urls[0], i) for i in [1..5]

      renderThumbnail = ->
        if not rendering
          thumbnails.update settings
        #for i in [0...5]
        #time = video.currentTime + (i - 2) * (1.0 / settings.getCaptureFrame())
        #thumbnails[i].update(time)
        #video.pause()

      toggleVideoPlay = ->
        video = $video.get(0)
        if video.paused
          video.play()
        else
          video.pause()
      renderThumbnail()

      $video.bind "pause", =>
        renderThumbnail()

      $video.bind "seeked", =>
        renderThumbnail()

      settings.bind "change", =>
        renderThumbnail()

      $video.bind "click", ->
        #toggleVideoPlay()

      $("#start").click ->
        time = $video.get(0).currentTime
        timelines.setStartTime time
        timelines.updateMakeButton()

      $("#stop").click ->
        time = $video.get(0).currentTime
        timelines.setStopTime time
        timelines.updateMakeButton()

      $("#refresh").click ->
        renderThumbnail()

      finalize = =>
        $video.get(0).controls = true
        rendering = false
        settings.disable false
        timelines.updateMakeButton()
        $("#capture").removeClass "disabled"

      $("#make").click ->
        video = $video.get(0)
        cropCoord = settings.getCropCoord()
        sourceWidth = if settings.isCrop() then cropCoord.w else video.videoWidth
        sourceHeight = if settings.isCrop() then cropCoord.h else video.videoHeight
        ratio = (settings.getGifSize sourceWidth) / sourceWidth
        resultWidth = settings.getGifSize sourceWidth
        resultHeight = sourceHeight * ratio

        gif = new GIF
          workers: 4
          workerScript: gifjsWorkerDist
          quality: 10
          width: resultWidth
          height: resultHeight
          dither: false
          pattern: true
          globalPalette: true

        gif.on "progress", (p) ->
          $("#progress_2").css "width", p*100 + "%"
          $("#progress_1").css "width", (1-p)*100 + "%"

        gif.on "finished", (blob) ->
          img = $("#result_image").get(0)
          img.src = URL.createObjectURL blob
          $("#result_status").text "Rendering finished : Filesize " +
          if (blob.size >= 1000000) then "#{ (blob.size / 1000000).toFixed 2 }MB"
          else "#{ (blob.size / 1000).toFixed 2 }KB"
          finalize()

        video.controls = false
        video.pause()
        $("#make").addClass "disabled"
        $("#capture").addClass "disabled"

        canvas = $("<canvas>").get(0)
        context = canvas.getContext("2d")

        canvas.width = resultWidth
        canvas.height = resultHeight

        rendering = true
        settings.disable true

        arr = timelines.getFrameList settings
        frameNumber = arr.length
        firstTime = arr[0]
        $("#progress_1").css "width", "0"
        $("#progress_2").css "width", "0"

        if frameNumber < 2
          finalize()
          return

        deferred = $.Deferred()
        deferred
        .then ->
          # timeupdate trigger
          if video.currentTime is arr[0]
            _deferred = $.Deferred()
            $video.on "timeupdate", =>
              $video.off "timeupdate"
              _deferred.resolve()
            video.currentTime = arr[1]
            _deferred
        .then ->
          $video.on "timeupdate", =>
            drawDeferred = $.Deferred()
            if arr.length is 0
              $video.off "timeupdate"
              gif.render()
              return
            $("#progress_1").css "width", (frameNumber - arr.length)/frameNumber*100 + "%"
            if settings.isCrop() then context.drawImage video,
              cropCoord.x, cropCoord.y, cropCoord.w, cropCoord.h, # source
              0, 0, resultWidth, resultHeight                     # dest
            else context.drawImage video,
              0, 0, resultWidth, resultHeight
            if settings.getEffectScript() isnt ""
              eval settings.getEffectScript()
            gif.addFrame canvas,
                copy: true
                delay: 1000.0 / settings.getCaptureFrame() / settings.getGifSpeed()
            if arr.length is 1
              arr.shift()
              video.currentTime = firstTime
            else
              arr.shift()
              video.currentTime = arr[0]
          video.currentTime = arr[0]

        deferred.resolve()

      $("#capture").click ->
        video = $video.get(0)
        cropCoord = settings.getCropCoord()
        sourceWidth = if settings.isCrop() then cropCoord.w else video.videoWidth
        sourceHeight = if settings.isCrop() then cropCoord.h else video.videoHeight
        ratio = (settings.getGifSize sourceWidth) / sourceWidth
        resultWidth = settings.getGifSize sourceWidth
        resultHeight = sourceHeight * ratio

        canvas = $("<canvas>").get(0)
        context = canvas.getContext("2d")
        canvas.width = resultWidth
        canvas.height = resultHeight

        if settings.isCrop() then context.drawImage video,
          cropCoord.x, cropCoord.y, cropCoord.w, cropCoord.h, # source
          0, 0, resultWidth, resultHeight                     # dest
        else context.drawImage video,
          0, 0, resultWidth, resultHeight
        if settings.getEffectScript() isnt ""
          eval settings.getEffectScript()
        $("#result_image").attr "src", canvas.toDataURL()


class Thumbnails
  constructor: () ->
    @thumbs = []
    @thumbs.push(new Thumbnail i, $("#thumbnail_#{i}")) for i in [1..5]

  update: (settings) ->
    for i in [0...5]
      time = $video.get(0).currentTime + (i - 2) * (1.0 / settings.getCaptureFrame())
      @thumbs[i].update(time)

    i = 0
    $backVideo.on "timeupdate", =>
      if i >= 5
        $backVideo.off "timeupdate"
      else
        @thumbs[i].draw()
        i++
        $backVideo.get(0).currentTime = $video.get(0).currentTime + (i - 2) * (1.0 / settings.getCaptureFrame())
    $backVideo.get(0).currentTime = $video.get(0).currentTime - 2 * (1.0 / settings.getCaptureFrame())


class Thumbnail
  constructor: (@id, @$canvas) ->
   # @$video = $backVideo #$("<video>")
    @canvas = $canvas.get(0)
    @context = @canvas.getContext("2d")

    #@$video.attr "src", url
    #@canvas.width = 100
    #@canvas.height = 100

    #$backVideo.bind "timeupdate", =>
    #  $("#thumbnail_" + @id).removeClass "loading"
    #  @context.drawImage $backVideo.get(0), 0, 0, 320, 160

    @canvas.addEventListener "click", =>
      #$video.get(0).pause()
      $video.get(0).currentTime = @time

  update: (@time) ->
    if time >= 0 or time <= video.duration
      $("#thumbnail_" + @id).addClass "loading"
      #$backVideo.get(0).currentTime = time

  draw: ->
    $("#thumbnail_" + @id).removeClass "loading"
    @context.drawImage $backVideo.get(0), 0, 0, 320, 160


class Timelines
  constructor: ->
    @tls = []
    @number = 1

    $("#add_timeline").bind "click", =>
      @tls.push new Timeline @, @number
      @number++
      @.updateMakeButton()
    .trigger "click"
    @tls[0].setSelected true

  setStartTime: (time) ->
    tl = @.getSelected()
    if tl? then tl.setStartTime time

  setStopTime: (time) ->
    tl = @.getSelected()
    if tl? then tl.setStopTime time

  setSelected: (tl) ->
    for i in @tls
      i.setSelected false
    tl.setSelected true

  getSelected: ->
    for i in @tls
      if i.getSelected()
        return i

  getFrameList: (settings) ->
    arr = []
    for tl in @tls
      arr.push(i) for i in tl.getFrameList settings
    return arr

  removeTimeline: (tl) ->
    for k, v of @tls
      if v is tl
        @tls.splice(k, 1)
    @updateMakeButton()

  updateOrder: ->
    arr = []
    num = $("#timeline_holder").sortable("toArray")
    for i in num
      for tl in @tls
        if tl.getNumber() is i then arr.push tl
    @tls = arr

  updateMakeButton: ->
    a = true
    for tl in @tls
      a = a and tl.isValidTime()
    if a and @tls.length > 0 then $("#make").removeClass "disabled" else $("#make").addClass "disabled"


class Timeline
  constructor: (@timelines, @number) ->
    @start = null
    @stop = null
    @selected = false

    @$timeline = $("#timeline_skeleton").clone()
    @$timeline.attr "id", number
    @$timeline.appendTo $("#timeline_holder")

    @startCanvas = @$timeline.find(".timeline-start").get(0)
    @stopCanvas = @$timeline.find(".timeline-stop").get(0)

    @$timeline.bind "click", =>
      timelines.setSelected @

    @$timeline.find(".close").bind "click", =>
      @.remove()

  setStartTime: (time) ->
    @start = time
    ctx = @startCanvas.getContext("2d")
    ctx.drawImage $video.get(0), 0, 0, 320, 160

  setStopTime: (time) ->
    @stop = time
    ctx = @stopCanvas.getContext("2d")
    ctx.drawImage $video.get(0), 0, 0, 320, 160

  isValidTime: ->
    if @start? and @stop? then true else false

  setSelected: (bool) ->
    @selected = bool
    if bool
      @$timeline.css "border-color", "red"
    else
      @$timeline.css "border-color", ""

  getNumber: ->
    return @$timeline.attr "id"

  getSelected: ->
    return @selected

  getFrameList: (settings) ->
    if not @.isValidTime()
      throw "start and stop time must fill"
    arr = []
    i = 0
    time = @start

    while (@start <= @stop and time <= @stop)or(@start > @stop and time >= @stop)
      arr.push(time)
      i++
      diff = i / settings.getCaptureFrame()
      if @start <= @stop then time = @start + diff
      else time = @start - diff

    return arr

  remove: ->
    @timelines.removeTimeline @
    @$timeline.remove()


class Settings
  captureFrameValues = [1, 2, 3, 4, 6, 8, 12, 15, 24, 30]
  gifSpeedValues = [0.5, 0.8, 1, 1.2, 1.5, 2, 3, 5]
  gifSizeValues = [40, 80, 120, 240, 320, 480, 640, 720]

  constructor: ->
    @$captureFrame = $("#form_capture_frame")
    @$gifSpeed = $("#form_gif_speed")
    @$gifSize = $("#form_gif_size")
    @event = {}

    @$captureFrame.append "<option value=#{i}>#{i}fps</option>" for i in captureFrameValues
    @$gifSpeed.append "<option value=#{i}>x#{i}</option>" for i in gifSpeedValues
    @$gifSize.append "<option value=-1>元サイズに合わせる</option>"
    @$gifSize.append "<option value=#{i}>#{i}px</option>" for i in gifSizeValues

    @captureFrameVal = 12
    @gifSpeedVal = 1
    @gifSizeVal = -1
    @effectScript = ""
    @crop = false

    @$captureFrame.val @captureFrameVal
    @$gifSpeed.val @gifSpeedVal
    @$gifSize.val @gifSizeVal

    @initJcrop()
    @initCodeMirror()

    ###@$captureFrame.bind "change", =>
      if "change" in @event then @event["change"]()
    @$gifSpeed.bind "change", =>
      if "change" in @event then @event["change"]()
    @$gifSize.bind "change", =>
      if "change" in @event then @event["change"]()###

    # modal_capture_frame
    $("#modal_capture_frame").on "hidden.bs.modal", =>
      @$captureFrame.val @captureFrameVal

    $("#modal_capture_frame_save").bind "click", =>
      @captureFrameVal = @$captureFrame.val()
      $("#modal_capture_frame").modal "hide"
      for type, fn of @event
        if type is "change" then do fn

    # modal_gif_size
    $("#modal_gif_size").on "hidden.bs.modal", =>
      @$gifSize.val @gifSizeVal

    $("#modal_gif_size_save").bind "click", =>
      @gifSizeVal = @$gifSize.val()
      $("#modal_gif_size").modal "hide"

    # modal_gif_speed
    $("#modal_gif_speed").on "hidden.bs.modal", =>
      @$gifSpeed.val @gifSpeedVal

    $("#modal_gif_speed_save").bind "click", =>
      @gifSpeedVal = @$gifSpeed.val()
      $("#modal_gif_speed").modal "hide"

    # modal_effect
    $("#modal_effect").on "hide.bs.modal", =>
      @codeMirrorApi.setValue @effectScript

    $("#modal_effect_save").bind "click", =>
      @effectScript = @codeMirrorApi.getValue()
      $("#modal_effect").modal "hide"

    $(".modal-effect-preset").bind "click", self:@, (event) ->
      event.data.self.codeMirrorApi.setValue preset[parseInt ($(@).attr "data-value"), 10]

    # modal_crop
    $("#modal_crop").on "shown.bs.modal", =>
      canvas = $("<canvas>").get(0)
      ctx = canvas.getContext("2d")
      video = $video.get(0)
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage video, 0, 0, video.videoWidth, video.videoHeight
      $("#modal_crop_img").get(0).onload = =>
        @initJcrop()
      $("#modal_crop_img").attr "src", canvas.toDataURL()

    $("#modal_crop").on "hidden.bs.modal", =>
      $("#form_crop").prop "checked", @crop
      @jcropApi.destroy()
      $("#modal_crop_img").attr "src", ""

    $("#modal_crop_save").bind "click", =>
      @crop = $("#form_crop").prop "checked"
      $("#modal_crop").modal "hide"

    $("#form_crop").bind "change", =>
      if $("#form_crop").prop "checked"
        @jcropApi.enable()
        @jcropApi.setSelect [0, 0, 50, 50]
      else
        @jcropApi.release()
        @jcropApi.disable()

    _ = @
    $(".modal-crop-aspect").bind "click", ->
      aspect = [0, 1, 4/3, 8/5, 3/4, 5/8]
      _.jcropApi.setOptions
        aspectRatio: aspect[parseInt ($(@).attr "data-value"), 10]

  initJcrop: ->
    @jcropApi = $.Jcrop "#modal_crop_img"
    $("#modal_crop_img").Jcrop
      onChange: (c) =>
        @cropCoords = c
      onSelect: (c) =>
        @cropCoords = c
    if @crop
      @jcropApi.setSelect [@cropCoords.x, @cropCoords.y, @cropCoords.x2, @cropCoords.y2]
    else
      @jcropApi.release()
      @jcropApi.disable()

  initCodeMirror: ->
    @codeMirrorApi = CodeMirror $("#form_effect_holder").get(0),
      mode: "javascript"
      indentUnit: 4
      lineNumbers: true
      styleActiveLine: true
      matchBrackets: true
      autoCloseBrackets: true

  bind: (type, fn) ->
    @event[type] = fn

  getCaptureFrame: ->
    @captureFrameVal

  getGifSpeed: ->
    @gifSpeedVal

  getGifSize: (size) ->
    if parseInt(@$gifSize.val(), 10) is -1 then size else @$gifSize.val()

  getEffectScript: ->
    @effectScript

  isCrop: ->
    @crop

  getCropCoord: ->
    @cropCoords

  disable: (bool) ->
    if bool then $("#config").addClass "disabled" else $("#config").removeClass "disabled"


# hitode909/rokuga
# https://github.com/hitode909/rokuga
class FileHandler
  constructor: (args) ->
    @$container = args.$container
    throw "$container required" unless @$container
    @$file_input = args.$file_input
    @bindEvents()

  bindEvents: ->
    @$container
    .on 'dragstart', =>
        true
    .on 'dragover', =>
        false
    .on 'dragenter', (event) =>
        if @$container.is event.target
          ($ this).trigger 'enter'
        false
    .on 'dragleave', (event) =>
        if @$container.is event.target
          ($ this).trigger 'leave'
    .on 'drop', (jquery_event) =>
        event = jquery_event.originalEvent
        files = event.dataTransfer.files
        if files.length > 0
          ($ this).trigger 'drop', [files]

          (@readFiles files).done (contents) =>
            ($ this).trigger 'data_url_prepared', [contents]

        false

    @$file_input.on 'change', (jquery_event) =>
      (@readFiles (@$file_input.get 0 ).files).done (contents) =>
        ($ this).trigger 'data_url_prepared', [contents]

  readFiles: (files) ->
    read_all = do $.Deferred
    contents = []
    i = 0

    role = =>
      if files.length <= i
        read_all.resolve contents
      else
        file = files[i++]
        (@readFile file).done (content) ->
          contents.push content
        .always ->
            do role

    do role

    do read_all.promise

  readFile: (file) ->
    read = do $.Deferred
    reader = new FileReader
    reader.onload = ->
      read.resolve reader.result
    reader.onerror = (error) ->
      read.reject error
    reader.readAsDataURL file

    do read.promise