// format: off
lazy val root =
  module("tarot-engine")
    .withHttpServer
    .withJson
    .withYaml
    .withLogging
    .withTesting
    .withTypeScriptCompilation
    .enablePlugins(JavaAppPackaging, DockerPlugin)
    .settings(
      // Native packager needs an explicit entry point because this project has web and console main classes
      Compile / mainClass := Some("com.htmlism.tarotengine.web.TarotEngineServiceApp"),
      dockerExposedPorts := Seq(8083),

      // https://github.com/typelevel/cats-effect/issues/4306
      bashScriptExtraDefines += """addJava "-Dcats.effect.warnOnNonMainThreadDetected=false""""
    )
