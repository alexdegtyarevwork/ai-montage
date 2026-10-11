// Лица по кадрам (Apple Vision): faces <video> [шаг кадров] → JSON-строки {f, faces:[[x,y,w,h]]} в долях кадра, начало сверху слева.
import Foundation
import AVFoundation
import Vision

let a = CommandLine.arguments
let step = a.count > 2 ? Int(a[2])! : 1
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let sem = DispatchSemaphore(value: 0)
var track: AVAssetTrack!
Task { track = try! await asset.loadTracks(withMediaType: .video).first!; sem.signal() }
sem.wait()
let reader = try! AVAssetReader(asset: asset)
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(out); reader.startReading()
var i = -1
while let sb = out.copyNextSampleBuffer() {
  i += 1
  if i % step != 0 { continue }
  guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
  let req = VNDetectFaceLandmarksRequest()
  try! VNImageRequestHandler(cvPixelBuffer: pb, options: [:]).perform([req])
  var faces: [String] = []
  for r in req.results ?? [] {
    let b = r.boundingBox
    // подбородок: нижняя точка контура лица (faceContour) в долях кадра
    var chin = 1 - b.minY
    if let c = r.landmarks?.faceContour {
      let pts = c.pointsInImage(imageSize: CGSize(width: 1, height: 1))
      chin = 1 - (pts.map { $0.y }.min() ?? b.minY)
    }
    faces.append(String(format: "[%.4f,%.4f,%.4f,%.4f,%.4f]", b.minX, 1 - b.maxY, b.width, b.height, chin))
  }
  print("{\"f\":\(i),\"faces\":[\(faces.joined(separator: ","))]}")
}
