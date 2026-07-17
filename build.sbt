// format: off
lazy val root =
  module("tarot-engine")
    .withHttpServer
    .withJson
    .withYaml
    .withLogging
    .withTesting
    .enablePlugins(JavaAppPackaging, DockerPlugin)
    .settings(
      Compile / mainClass := Some("com.htmlism.tarotengine.web.TarotEngineServiceApp"),
      dockerExposedPorts := Seq(8083),

      // https://github.com/typelevel/cats-effect/issues/4306
      bashScriptExtraDefines += """addJava "-Dcats.effect.warnOnNonMainThreadDetected=false""""
    )
