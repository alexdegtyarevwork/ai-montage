// Сборщик Remotion (webpack) умеет require.context: подключить все подходящие файлы папки без списка вручную.
// Так ролики ученика из src/mine/ попадают в студию, не правя общие файлы набора (обновление их не задевает).
declare namespace NodeJS {
  interface Require {
    context(dir: string, deep: boolean, filter: RegExp): {keys(): string[]; (id: string): any};
  }
}
