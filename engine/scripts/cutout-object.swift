// Вырезка предмета с фото (кот, ветка, комар) маской объекта Apple Vision (macOS 14+).
//   swiftc -O scripts/cutout-object.swift -o tmp/cutobj && tmp/cutobj in.jpg out.png
// Выход: PNG с альфой, обрезанный по предмету с полями 4%.
import Foundation
import Vision
import CoreImage
import AppKit

let a = CommandLine.arguments
guard a.count >= 3, let ci = CIImage(contentsOf: URL(fileURLWithPath: a[1])) else { print("usage: cutobj in out"); exit(2) }
let handler = VNImageRequestHandler(ciImage: ci, options: [:])
let req = VNGenerateForegroundInstanceMaskRequest()
do { try handler.perform([req]) } catch { print("vision error \(error)"); exit(1) }
guard let obs = req.results?.first else { print("NO OBJECT \(a[1])"); exit(1) }
let buf = try! obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false)
var out = CIImage(cvPixelBuffer: buf)
// обрезка по непрозрачной области
let ctx = CIContext()
let w = Int(out.extent.width), h = Int(out.extent.height)
guard let cg = ctx.createCGImage(out, from: out.extent) else { exit(1) }
let rep = NSBitmapImageRep(cgImage: cg)
var minX = w, minY = h, maxX = 0, maxY = 0
let step = 2
for y in stride(from: 0, to: h, by: step) { for x in stride(from: 0, to: w, by: step) {
  if let c = rep.colorAt(x: x, y: y), c.alphaComponent > 0.1 { minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y) }
} }
let pad = Int(Double(max(maxX - minX, maxY - minY)) * 0.04)
let rx = max(0, minX - pad), ry = max(0, minY - pad), rw = min(w, maxX + pad) - rx, rh = min(h, maxY + pad) - ry
// NSBitmapImageRep: y сверху; CIImage: y снизу
let crop = CGRect(x: rx, y: h - (ry + rh), width: rw, height: rh)
out = out.cropped(to: crop)
let cg2 = ctx.createCGImage(out, from: out.extent)!
let png = NSBitmapImageRep(cgImage: cg2).representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: a[2]))
print("ok \(a[2]) \(rw)x\(rh) instances=\(obs.allInstances.count)")
