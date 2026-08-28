import scala.sys.process.Process

import sbt.Keys.*
import sbt.*

object TypeScriptCompilationPlugin extends AutoPlugin {
  override def trigger: PluginTrigger =
    allRequirements

  object autoImport {
    val compileTypeScript = taskKey[Seq[File]]("Compile TypeScript into managed resources")
    val testTypeScript    = taskKey[Unit]("Run TypeScript unit tests")

    implicit class TypeScriptCompilationOps(private val project: Project) extends AnyVal {
      def withTypeScriptCompilation: Project =
        project.settings(
          compileTypeScript := {
            val projectRoot = baseDirectory.value
            val outputDir   = (Compile / resourceManaged).value
            val log         = streams.value.log

            IO.createDirectory(outputDir)

            val exitCode = Process(
              Seq(
                "npm",
                "run",
                "build:ts",
                "--",
                "--outDir",
                outputDir.getAbsolutePath
              ),
              projectRoot
            ).!

            if (exitCode != 0)
              sys.error("TypeScript compilation failed")

            val generatedResources = (outputDir ** "*").get.filter { file =>
              file.getName.endsWith(".js") || file.getName.endsWith(".js.map")
            }

            log.info(s"Generated ${generatedResources.size} resources from TypeScript")

            generatedResources
          },
          testTypeScript := {
            val projectRoot = baseDirectory.value
            val exitCode    = Process(Seq("npm", "run", "test:ts"), projectRoot).!

            if (exitCode != 0)
              sys.error("TypeScript tests failed")
          },
          Compile / resourceGenerators += compileTypeScript.taskValue,
          Test / test := ((Test / test) dependsOn testTypeScript).value
        )
    }
  }
}
