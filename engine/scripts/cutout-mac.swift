// Вырезка спикера на macOS: маска человека Apple Vision на каждый кадр.
//   swiftc -O scripts/cutout-mac.swift -o tmp/segvid && tmp/segvid public/work/<slug>/speaker.mp4 tmp/masks
//   ffmpeg -i speaker.mp4 -framerate <fps> -i tmp/masks/m_%05d.png -filter_complex "[1:v]format=gray,tmix=frames=3:weights=1 2 1,gblur=sigma=1.2[m];[0:v][m]alphamerge,format=yuva420p" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 12M speaker-cutout.webm
// В Remotion: <OffthreadVideo src=… transparent />.
import Foundation
import AVFoundation
import Vision
import CoreImage
import AppKit
// segvid <video> <outdir>: маска человека (Apple Vision, accurate) на каждый кадр → outdir/m_00001.png
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let outDir = a[2]
let sem = DispatchSemaphore(value: 0)
var track: AVAssetTrack!
Task { track = try! await asset.loadTracks(withMediaType: .video).first!; sem.signal() }
sem.wait()
let reader = try! AVAssetReader(asset: asset)
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(out); reader.startReading()
let ctx = CIContext()
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
var i = 0
while let sb = out.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
  i += 1
  let w = CVPixelBufferGetWidth(pb), h = CVPixelBufferGetHeight(pb)
  try! VNImageRequestHandler(cvPixelBuffer: pb, options: [:]).perform([req])
  var m = CIImage(cvPixelBuffer: req.results!.first!.pixelBuffer)
  m = m.transformed(by: CGAffineTransform(scaleX: CGFloat(w) / m.extent.width, y: CGFloat(h) / m.extent.height))
  let cg = ctx.createCGImage(m, from: CGRect(x: 0, y: 0, width: w, height: h), format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())!
  let rep = NSBitmapImageRep(cgImage: cg)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: String(format: "%@/m_%05d.png", outDir, i)))
  if i % 50 == 0 { print("frame", i) }
}
print("done", i)
