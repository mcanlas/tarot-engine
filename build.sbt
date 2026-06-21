// format: off
lazy val root =
  module("tarot-engine")
    .withHttpServer
    .withJson
    .withYaml
    .withLogging
    .enablePlugins(JavaAppPackaging, DockerPlugin)
    .settings(
      dockerExposedPorts := Seq(8083),

      // https://github.com/typelevel/cats-effect/issues/4306
      bashScriptExtraDefines += """addJava "-Dcats.effect.warnOnNonMainThreadDetected=false""""
    )
